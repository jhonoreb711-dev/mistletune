import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { setAudioModeAsync, useAudioPlaylist, useAudioPlaylistStatus } from 'expo-audio';
import { useVideoPlayer } from 'expo-video';
import { useEventListener } from 'expo';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocalLibraryId } from './localLibraryIdentity';
import { appendQueueTrack, queueAfterRemoval } from './queueUtils';
import { getFolderLabel, importSelectedAudioFiles, listImportedAudio, scanMusicFolder, selectMusicFolder, clearLocalLibrary } from './localMusicLibrary';
import { clearAllGeneratedLyrics } from './generatedLyricsCache';
import { addRecentlyPlayed, getRecentlyPlayed } from './recentlyPlayed';
import { addSavedTrackArtwork, pickTrackArtwork, removeTrackArtwork } from './trackArtwork';
import * as FileSystem from 'expo-file-system/legacy';
import { HOME_VIDEO_URI_KEY, HOME_VIDEO_NAME_KEY } from './homeVideoStorage';
import { pickAndSaveHomeVideo, restoreDefaultHomeVideo } from './videoFileService';
import { useTheme } from '../themes/ThemeProvider';
import { batchTranscribeTracks } from './batchTranscription';
import LyricsPreparationOverlay from './LyricsPreparationOverlay';

const musicFolderKey = (libraryId) => `music-player.music-folder-uri:${libraryId}`;
const EMPTY_TRACKS = [];

const PlaybackContext = createContext(null);

export function PlaybackProvider({ children }) {
  const { theme } = useTheme();
  const homeVideo = theme.assets.homeVideo;
  const defaultVideoName = theme.homeVideoName;
  const [homeVideoName, setHomeVideoName] = useState(defaultVideoName);
  const [isCustomHomeVideo, setIsCustomHomeVideo] = useState(false);
  const [homeVideoRevision, setHomeVideoRevision] = useState(0);
  const [isSpeechActive, setIsSpeechActive] = useState(false);

  const homeVideoPlayer = useVideoPlayer(null, (videoPlayer) => {
    videoPlayer.loop = true;
  });

  const setSpeechActive = useCallback((active) => {
    setIsSpeechActive(Boolean(active));
    if (active) {
      try {
        homeVideoPlayer.pause();
      } catch {}
    }
  }, [homeVideoPlayer]);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(HOME_VIDEO_URI_KEY).then(async (storedUri) => {
      if (!active) return;
      if (storedUri) {
        try {
          const info = await FileSystem.getInfoAsync(storedUri);
          if (info.exists && info.size > 0) {
            const storedName = await AsyncStorage.getItem(HOME_VIDEO_NAME_KEY);
            if (!active) return;
            await homeVideoPlayer.replaceAsync({ uri: storedUri });
            Reflect.set(homeVideoPlayer, 'loop', true);
            if (active) {
              setHomeVideoName(storedName || 'Custom Video');
              setIsCustomHomeVideo(true);
              setHomeVideoRevision((revision) => revision + 1);
            }
            return;
          }
        } catch {}
        await AsyncStorage.multiRemove([HOME_VIDEO_URI_KEY, HOME_VIDEO_NAME_KEY]);
      }
      if (active) {
        homeVideoPlayer.pause();
        await homeVideoPlayer.replaceAsync(typeof homeVideo === 'number' ? homeVideo : null);
        if (!active) return;
        Reflect.set(homeVideoPlayer, 'loop', true);
        setHomeVideoName(defaultVideoName);
        setIsCustomHomeVideo(false);
        setHomeVideoRevision((revision) => revision + 1);
      }
    }).catch(() => {});
    return () => { active = false; };
  }, [homeVideoPlayer, homeVideo, defaultVideoName]);

  const changeHomeVideo = useCallback(async () => {
    const saved = await pickAndSaveHomeVideo();
    if (!saved) return null;
    await homeVideoPlayer.replaceAsync({ uri: saved.uri });
    Reflect.set(homeVideoPlayer, 'loop', true);
    try {
      Reflect.set(homeVideoPlayer, 'currentTime', 0);
    } catch {}
    setHomeVideoName(saved.name);
    setIsCustomHomeVideo(true);
    setHomeVideoRevision((revision) => revision + 1);
    return saved;
  }, [homeVideoPlayer]);

  const resetHomeVideo = useCallback(async () => {
    // Unload a custom video before removing its file, including GIF-only themes.
    homeVideoPlayer.pause();
    await homeVideoPlayer.replaceAsync(typeof homeVideo === 'number' ? homeVideo : null);
    await restoreDefaultHomeVideo();
    Reflect.set(homeVideoPlayer, 'loop', true);
    try {
      Reflect.set(homeVideoPlayer, 'currentTime', 0);
    } catch {}
    setHomeVideoName(defaultVideoName);
    setIsCustomHomeVideo(false);
    setHomeVideoRevision((revision) => revision + 1);
  }, [homeVideoPlayer, homeVideo, defaultVideoName]);
  const hasStartedPlayback = useRef(false);
  const pendingTrackStart = useRef(null);
  const audioModeReady = useRef(null);
  const originalTracksRef = useRef(EMPTY_TRACKS);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [tracks, setTracks] = useState(EMPTY_TRACKS);
  const [queue, setQueue] = useState({ tracks: EMPTY_TRACKS, kind: 'library' });
  const [musicFolderUri, setMusicFolderUri] = useState(null);
  const [libraryId, setLibraryId] = useState(null);
  const [recentlyPlayed, setRecentlyPlayed] = useState([]);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [loopMode, setLoopMode] = useState('all');
  const playlistSources = useMemo(() => queue.tracks.map((track) => track.source), [queue.tracks]);
  const playlistOptions = useMemo(() => ({ sources: playlistSources, loop: 'all' }), [playlistSources]);
  const player = useAudioPlaylist(playlistOptions);
  const status = useAudioPlaylistStatus(player);
  const statusRef = useRef(status);
  useEffect(() => { statusRef.current = status; });
  const playerRef = useRef(player);
  const lockScreenRegistration = useRef(null);
  const preparation = useRef(null);
  const requestNumber = useRef(0);
  const startQueueNowRef = useRef(null);
  const queueResumeRef = useRef(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const [lyricsPreparation, setLyricsPreparation] = useState(null);
  const [lyricsRevision, setLyricsRevision] = useState(0);

  const configureAudioMode = useCallback(() => {
    if (!audioModeReady.current) {
      audioModeReady.current = setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
      }).catch((error) => {
        audioModeReady.current = null;
        throw error;
      });
    }
    return audioModeReady.current;
  }, []);

  const activateLockScreenControls = useCallback(async (track, queueTracks, recentItem) => {
    // Expo Go does not contain this app's AudioControlsService. Trying to bind
    // its Android media session from Expo Go logs a service-binding error.
    if (Platform.OS === 'web' || (Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient)) return;

    // The native media session must be configured after the audio mode is ready.
    // Otherwise Android can start playback before Expo Audio has the session ready.
    await configureAudioMode();
    if (playerRef.current !== player) return;

    const artworkUrl = typeof track?.artwork === 'string' ? track.artwork : track?.artwork?.uri;
    const metadata = {
      title: track?.title || 'Unknown track',
      artist: track?.artist || 'Unknown artist',
      albumTitle: track?.album || recentItem?.title || 'MistleTunes',
      ...(artworkUrl ? { artworkUrl } : {}),
    };

    try {
      const registration = lockScreenRegistration.current;
      const optionsKey = queueTracks.length > 1;
      if (registration?.player === player && registration.optionsKey === optionsKey) {
        player.updateLockScreenMetadata(metadata);
        return;
      }
      player.setActiveForLockScreen(true, metadata, {
        showNextTrack: queueTracks.length > 1,
        showPreviousTrack: queueTracks.length > 1,
        showSeekBackward: true,
        showSeekForward: true,
      });
      lockScreenRegistration.current = { player, optionsKey };
    } catch (error) {
      console.warn('Could not activate Android media controls:', error);
    }
  }, [configureAudioMode, player]);

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    configureAudioMode().catch((error) => {
      console.warn('Could not configure background audio:', error);
    });
  }, [configureAudioMode]);

  useEffect(() => {
    if (Platform.OS === 'web' || (Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient)) return;
    if (!currentTrack) {
      player.clearLockScreenControls();
      lockScreenRegistration.current = null;
      return;
    }
    // Wait for a real, loaded track. Queue changes replace the native player;
    // registering before it is ready races the previous player's cleanup.
    if (!status.isLoaded || !status.playing) return;
    activateLockScreenControls(currentTrack, queue.tracks, queue.recentItem).catch(() => {});
  }, [activateLockScreenControls, currentTrack, player, queue.recentItem, queue.tracks, status.isLoaded, status.playing]);

  useEventListener(player, 'trackChanged', ({ currentIndex }) => {
    if (preparation.current) return;
    if (!hasStartedPlayback.current) return;
    // Rebuilding a playlist can emit its initial index before resume completes.
    if (queueResumeRef.current) return;
    const activeTrack = queue.tracks[currentIndex];
    if (activeTrack) setCurrentTrack(activeTrack);
  }, [queue.tracks]);

  useEffect(() => {
    const pendingTrackId = pendingTrackStart.current;
    if (!pendingTrackId) return;
    const index = queue.tracks.findIndex((track) => track.id === pendingTrackId);
    if (index < 0) return;
    pendingTrackStart.current = null;
    const token = requestNumber.current;
    configureAudioMode().then(() => {
      if (token !== requestNumber.current || preparation.current) return;
      player.skipTo(index);
      player.play();
    }).catch((error) => {
      console.warn('Could not start playlist playback:', error);
    });
  }, [configureAudioMode, player, queue]);

  // Restore the playing track's position after a queue reorder (the playlist
  // re-creates its native player when sources change).
  useEffect(() => {
    const resume = queueResumeRef.current;
    if (!resume) return undefined;
    if (preparation.current) { queueResumeRef.current = null; return undefined; }
    const index = queue.tracks.findIndex((track) => track.id === resume.trackId);
    if (index < 0) { queueResumeRef.current = null; return undefined; }
    const token = requestNumber.current;
    let cancelled = false;
    configureAudioMode().then(async () => {
      if (cancelled || token !== requestNumber.current) return;
      try { playerRef.current.skipTo(index); } catch { return; }
      // The freshly re-created native player needs a moment before it can seek.
      const deadline = Date.now() + 2500;
      while (playerRef.current && !playerRef.current.isLoaded && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 120));
        if (cancelled || token !== requestNumber.current) return;
      }
      try { await playerRef.current.seekTo(resume.time); } catch { /* keep current position */ }
      try { if (resume.wasPlaying) playerRef.current.play(); else playerRef.current.pause(); } catch {}
      queueResumeRef.current = null;
    });
    return () => { cancelled = true; };
  }, [configureAudioMode, queue]);

  useEffect(() => {
    let active = true;
    getLocalLibraryId().then((id) => { if (active) setLibraryId(id); }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (libraryId) {
      getRecentlyPlayed(libraryId).then((entries) => {
        if (active) setRecentlyPlayed(entries);
      });
    }
    return () => { active = false; };
  }, [libraryId]);

  useEffect(() => {
    if (!libraryId) return undefined;
    const expiryCheck = setInterval(() => {
      getRecentlyPlayed(libraryId).then(setRecentlyPlayed);
    }, 60_000);
    return () => clearInterval(expiryCheck);
  }, [libraryId]);

  useEffect(() => {
    if (!libraryId) return undefined;
    let active = true;
    Promise.all([
      AsyncStorage.getItem(musicFolderKey(libraryId)),
      listImportedAudio(libraryId),
    ]).then(([savedFolderUri, importedTracks]) => {
        if (!active) return;
        // Older builds stored a display path (for example "Music/Music Player")
        // or a raw file:// path here. Android's scoped storage cannot rescan
        // those values; the folder must be selected again through the SAF picker.
        const usableFolderUri = Platform.OS === 'android'
          && savedFolderUri
          && !savedFolderUri.startsWith('content://')
          ? null
          : savedFolderUri;
        if (savedFolderUri && !usableFolderUri) {
          AsyncStorage.removeItem(musicFolderKey(libraryId)).catch(() => {});
          AsyncStorage.removeItem(`music-player.music-folder-owned:${libraryId}`).catch(() => {});
        }
        setMusicFolderUri(usableFolderUri);
        addSavedTrackArtwork(libraryId, importedTracks).then((tracksWithArtwork) => {
          if (!active) return;
          setTracks(tracksWithArtwork);
          setQueue({ tracks: tracksWithArtwork, kind: 'library' });
        });
    }).catch(() => {
        if (active) {
          setMusicFolderUri(null);
          setTracks(EMPTY_TRACKS);
          setQueue({ tracks: EMPTY_TRACKS, kind: 'library' });
        }
    });
    return () => { active = false; };
  }, [libraryId]);

  const chooseMusicFolder = useCallback(async (onProgress) => {
    if (!libraryId) throw new Error('Your music library is still loading. Try again in a moment.');
    const directory = await selectMusicFolder();
    await AsyncStorage.setItem(musicFolderKey(libraryId), directory.uri);
    await AsyncStorage.setItem(`music-player.music-folder-owned:${libraryId}`, '1');
    setMusicFolderUri(directory.uri);
    onProgress?.({ stage: 'importing', message: 'Adding your music...' });
    const importedTracks = await scanMusicFolder(directory.uri, libraryId);
    const tracksWithArtwork = await addSavedTrackArtwork(libraryId, importedTracks);
    onProgress?.({ stage: 'transcribing', message: 'Getting lyrics ready...' });
    const lyricResults = await batchTranscribeTracks(tracksWithArtwork, libraryId, onProgress);
    setTracks(tracksWithArtwork);
    setQueue((current) => current.kind === 'library' ? { tracks: tracksWithArtwork, kind: 'library' } : current);
    setLyricsRevision((revision) => revision + 1);
    return { folderName: getFolderLabel(directory.uri), trackCount: tracksWithArtwork.length, lyricResults };
  }, [libraryId]);

  const rescanMusicFolder = useCallback(async (onProgress) => {
    if (!libraryId) throw new Error('Your music library is still loading. Try again in a moment.');
    onProgress?.({ stage: 'importing', message: 'Checking for songs...' });
    const importedTracks = await scanMusicFolder(musicFolderUri, libraryId);
    const updatedTracks = await addSavedTrackArtwork(libraryId, importedTracks);
    await batchTranscribeTracks(updatedTracks, libraryId, onProgress);
    setTracks(updatedTracks);
    setQueue((current) => current.kind === 'library' ? { tracks: updatedTracks, kind: 'library' } : current);
    setLyricsRevision((revision) => revision + 1);
    return importedTracks.length;
  }, [libraryId, musicFolderUri]);

  const addAudioFiles = useCallback(async (onProgress) => {
    if (!libraryId) throw new Error('Your music library is still loading. Try again in a moment.');
    onProgress?.({ stage: 'importing', message: 'Adding your songs...' });
    const importedTracks = await importSelectedAudioFiles(libraryId);
    const updatedTracks = await addSavedTrackArtwork(libraryId, importedTracks);
    const lyricResults = await batchTranscribeTracks(updatedTracks, libraryId, onProgress);
    setTracks(updatedTracks);
    setQueue((current) => current.kind === 'library' ? { tracks: updatedTracks, kind: 'library' } : current);
    setLyricsRevision((revision) => revision + 1);
    return { count: importedTracks.length, lyricResults };
  }, [libraryId]);

  const finishPreparation = useCallback((playWithoutLyrics = false) => {
    const pending = preparation.current;
    requestNumber.current++;
    preparation.current = null;
    pending?.task?.cancel();
    setLyricsPreparation(null);
    if (playWithoutLyrics && pending) startQueueNowRef.current?.(...pending.args);
  }, []);

  const clearLibrary = useCallback(async () => {
    if (!libraryId) return;
    try {
      if (playerRef.current) playerRef.current.pause();
    } catch {}
    finishPreparation();
    setCurrentTrack(null);
    setTracks(EMPTY_TRACKS);
    setQueue({ tracks: EMPTY_TRACKS, kind: 'library' });
    setMusicFolderUri(null);
    await clearLocalLibrary(libraryId);
    await clearAllGeneratedLyrics();
    await AsyncStorage.removeItem(musicFolderKey(libraryId));
    await AsyncStorage.removeItem(`music-player.music-folder-owned:${libraryId}`);
    setLyricsRevision((revision) => revision + 1);
  }, [finishPreparation, libraryId]);

  const updateTrackArtwork = useCallback((trackId, artworkUri) => {
    const update = (track) => track?.id === trackId
      ? { ...track, artwork: artworkUri ? { uri: artworkUri } : null }
      : track;
    setTracks((current) => current.map(update));
    setQueue((current) => ({ ...current, tracks: current.tracks.map(update) }));
    setCurrentTrack((current) => update(current));
  }, []);

  const editTrackArtwork = useCallback(async (trackId) => {
    if (!libraryId) throw new Error('Your music library is still loading. Try again in a moment.');
    const artworkUri = await pickTrackArtwork(libraryId, trackId);
    if (artworkUri) updateTrackArtwork(trackId, artworkUri);
    return artworkUri;
  }, [libraryId, updateTrackArtwork]);

  const clearTrackArtwork = useCallback(async (trackId) => {
    await removeTrackArtwork(libraryId, trackId);
    updateTrackArtwork(trackId, null);
  }, [libraryId, updateTrackArtwork]);

  const startQueueNow = useCallback((queueTracks, track, kind, recentItem = null) => {
    if (!track?.source || !queueTracks.length) return false;
    const index = queueTracks.findIndex((item) => item.id === track.id);
    if (index < 0) return false;
    const token = requestNumber.current;
    hasStartedPlayback.current = true;
    setCurrentTrack(track);
    const historyEntry = recentItem ?? { type: 'track', id: track.id, title: track.title, artist: track.artist };
    if (libraryId) {
      addRecentlyPlayed(libraryId, historyEntry).then(setRecentlyPlayed).catch(() => {});
    }
    const queueMatches = queue.tracks.length === queueTracks.length
      && queue.tracks.every((item, itemIndex) => item.id === queueTracks[itemIndex]?.id);
    if (queueMatches) {
      setQueue({ tracks: queueTracks, kind, recentItem });
      configureAudioMode().then(() => {
        if (token !== requestNumber.current || preparation.current) return;
        player.skipTo(index);
        player.play();
      }).catch((error) => {
        console.warn('Could not start playlist playback:', error);
      });
    } else {
      pendingTrackStart.current = track.id;
      setQueue({ tracks: queueTracks, kind, recentItem });
    }
    return true;
  }, [configureAudioMode, libraryId, player, queue]);

  useEffect(() => { startQueueNowRef.current = startQueueNow; }, [startQueueNow]);

  useEffect(() => () => {
    requestNumber.current++;
    preparation.current?.task?.cancel();
  }, []);

  const startQueue = useCallback((queueTracks, track, kind, recentItem = null) => {
    if (!track?.source || !queueTracks.some((item) => item.id === track.id)) return false;
    finishPreparation();
    return startQueueNowRef.current?.(queueTracks, track, kind, recentItem) ?? false;
  }, [finishPreparation]);

  const playTrack = useCallback((track) => {
    setShuffleEnabled(false);
    originalTracksRef.current = tracks;
    return startQueue(tracks, track, 'library');
  }, [startQueue, tracks]);
  const playQueue = useCallback((queueTracks, track = queueTracks[0], recentItem = null, origin = null) => {
    setShuffleEnabled(false);
    originalTracksRef.current = queueTracks;
    return startQueue(queueTracks, track, origin === 'benjie-playlist' ? 'benjie-playlist' : 'custom', recentItem);
  }, [startQueue]);

  const togglePlayback = useCallback(() => {
    if (preparation.current) return;
    if (!currentTrack) {
      const firstPlayable = tracks.find((track) => track.source);
      if (firstPlayable) playTrack(firstPlayable);
      return;
    }
    if (status.playing) player.pause();
    else player.play();
  }, [currentTrack, playTrack, player, status.playing, tracks]);

  const skip = useCallback((direction) => {
    if (!queue.tracks.length) return;
    const index = queue.tracks.findIndex((track) => track.id === currentTrack?.id);
    const nextIndex = (Math.max(index, 0) + direction + queue.tracks.length) % queue.tracks.length;
    startQueue(queue.tracks, queue.tracks[nextIndex], queue.kind, queue.recentItem);
  }, [currentTrack, queue, startQueue]);

  const toggleShuffle = useCallback(() => {
    if (queue.tracks.length < 2) return false;
    if (shuffleEnabled) {
      const original = originalTracksRef.current.length > 0 ? originalTracksRef.current : tracks;
      const current = original.find((track) => track.id === currentTrack?.id) ?? currentTrack;
      setShuffleEnabled(false);
      startQueue(original, current, queue.kind, queue.recentItem);
      return false;
    }
    originalTracksRef.current = queue.tracks;
    const current = queue.tracks.find((track) => track.id === currentTrack?.id);
    const remaining = queue.tracks.filter((track) => track.id !== current?.id);
    for (let index = remaining.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [remaining[index], remaining[swapIndex]] = [remaining[swapIndex], remaining[index]];
    }
    let shuffledTracks = current ? [current, ...remaining] : remaining;
    const orderUnchanged = shuffledTracks.every((track, index) => track.id === queue.tracks[index]?.id);
    if (orderUnchanged && remaining.length > 1) {
      const [firstRemaining] = remaining.splice(0, 1);
      remaining.push(firstRemaining);
      shuffledTracks = current ? [current, ...remaining] : remaining;
    }
    setShuffleEnabled(true);
    startQueue(shuffledTracks, current ?? shuffledTracks[0], queue.kind, queue.recentItem);
    return true;
  }, [currentTrack, queue, shuffleEnabled, startQueue, tracks]);

  const toggleLoopMode = useCallback(() => {
    const nextMode = loopMode === 'all' ? 'single' : loopMode === 'single' ? 'none' : 'all';
    try {
      if (playerRef.current) {
        Reflect.set(playerRef.current, 'loop', nextMode);
      }
    } catch {}
    setLoopMode(nextMode);
    return nextMode;
  }, [loopMode]);

  const addToQueue = useCallback((track) => {
    if (preparation.current || appendQueueTrack(queue.tracks, track) === queue.tracks) return false;
    if (currentTrack?.id && !queueResumeRef.current) {
      queueResumeRef.current = { trackId: currentTrack.id, time: statusRef.current?.currentTime ?? 0, wasPlaying: Boolean(statusRef.current?.playing) };
    }
    originalTracksRef.current = appendQueueTrack(originalTracksRef.current.length ? originalTracksRef.current : queue.tracks, track);
    setQueue((current) => ({ ...current, kind: 'custom', tracks: appendQueueTrack(current.tracks, track) }));
    return true;
  }, [currentTrack, queue.tracks]);

  // A removed playing track advances to its successor; removing the last stops playback.
  const removeFromQueue = useCallback((trackId) => {
    if (preparation.current || !trackId) return false;
    const removal = queueAfterRemoval(queue.tracks, trackId, currentTrack?.id);
    if (removal.tracks === queue.tracks) return false;
    originalTracksRef.current = originalTracksRef.current.filter((track) => track.id !== trackId);
    if (removal.nextTrack !== undefined) {
      pendingTrackStart.current = null;
      if (removal.nextTrack) {
        queueResumeRef.current = { trackId: removal.nextTrack.id, time: 0, wasPlaying: queueResumeRef.current?.wasPlaying ?? Boolean(statusRef.current?.playing) };
      } else {
        playerRef.current?.pause();
        queueResumeRef.current = null;
        hasStartedPlayback.current = false;
        setShuffleEnabled(false);
      }
      setCurrentTrack(removal.nextTrack);
    } else if (currentTrack?.id && !queueResumeRef.current) {
      queueResumeRef.current = { trackId: currentTrack.id, time: statusRef.current?.currentTime ?? 0, wasPlaying: Boolean(statusRef.current?.playing) };
    }
    setQueue((current) => {
      if (!current.tracks.some((track) => track.id === trackId)) return current;
      return { ...current, tracks: current.tracks.filter((track) => track.id !== trackId) };
    });
    return true;
  }, [currentTrack, queue.tracks]);

  const openQueueSheet = useCallback(() => setQueueOpen(true), []);
  const closeQueueSheet = useCallback(() => setQueueOpen(false), []);

  // Move a queued track (including the one playing) to a new position. The
  // native playlist re-creates itself when sources change, so the playing
  // track's position and play state are restored afterwards.
  const reorderQueue = useCallback((fromIndex, toIndex) => {
    if (preparation.current) return;
    const tracks = queue.tracks;
    if (tracks.length < 2 || fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= tracks.length || toIndex < 0 || toIndex >= tracks.length) return;
    const nextTracks = tracks.slice();
    const [moved] = nextTracks.splice(fromIndex, 1);
    nextTracks.splice(toIndex, 0, moved);
    if (currentTrack?.id) {
      queueResumeRef.current = { trackId: currentTrack.id, time: statusRef.current?.currentTime ?? 0, wasPlaying: Boolean(statusRef.current?.playing) };
    }
    if (shuffleEnabled) setShuffleEnabled(false);
    setQueue((current) => ({ ...current, tracks: nextTracks }));
  }, [currentTrack, queue.tracks, shuffleEnabled]);

  const stopPlayback = useCallback(() => {
    finishPreparation();
    pendingTrackStart.current = null;
    hasStartedPlayback.current = false;
    setShuffleEnabled(false);
    player.pause();
    player.seekTo(0);
    setCurrentTrack(null);
    setQueue({ tracks: EMPTY_TRACKS, kind: 'library' });
  }, [finishPreparation, player]);

  const value = useMemo(() => ({
    player,
    homeVideoPlayer,
    homeVideoName,
    homeVideoRevision,
    isCustomHomeVideo,
    changeHomeVideo,
    resetHomeVideo,
    isSpeechActive,
    setSpeechActive,
    currentTrack,
    lyricsRevision,
    editTrackArtwork,
    clearTrackArtwork,
    libraryId,
    recentlyPlayed,
    shuffleEnabled,
    canShuffle: queue.tracks.length > 1,
    loopMode,
    tracks,
    musicFolderUri,
    musicFolderName: getFolderLabel(musicFolderUri),
    playing: status.playing,
    currentTime: status.currentTime ?? 0,
    duration: status.duration ?? 0,
    queueTracks: queue.tracks,
    queueKind: queue.kind,
    playTrack,
    playQueue,
    chooseMusicFolder,
    rescanMusicFolder,
    addAudioFiles,
    clearLibrary,
    togglePlayback,
    skip,
    toggleShuffle,
    shuffleQueue: toggleShuffle,
    toggleLoopMode,
    stopPlayback,
    seekTo: (seconds) => player.seekTo(seconds),
    queueOpen,
    openQueueSheet,
    closeQueueSheet,
    reorderQueue,
    removeFromQueue,
    addToQueue,
  }), [homeVideoPlayer, homeVideoName, homeVideoRevision, isCustomHomeVideo, changeHomeVideo, resetHomeVideo, isSpeechActive, setSpeechActive, libraryId, lyricsRevision, addAudioFiles, chooseMusicFolder, clearLibrary, clearTrackArtwork, currentTrack, editTrackArtwork, loopMode, musicFolderUri, player, playQueue, playTrack, recentlyPlayed, rescanMusicFolder, shuffleEnabled, toggleShuffle, toggleLoopMode, queueOpen, openQueueSheet, closeQueueSheet, reorderQueue, removeFromQueue, addToQueue, queue.tracks, queue.kind, skip, status.currentTime, status.duration, status.playing, stopPlayback, togglePlayback, tracks]);

  return <PlaybackContext.Provider value={value}>{children}
    <LyricsPreparationOverlay state={lyricsPreparation} onCancel={() => finishPreparation()} onSkip={() => finishPreparation(true)} />
  </PlaybackContext.Provider>;
}

export function usePlayback() {
  const context = useContext(PlaybackContext);
  if (!context) throw new Error('usePlayback must be used inside PlaybackProvider');
  return context;
}
