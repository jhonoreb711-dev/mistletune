<<<<<<< HEAD
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
=======
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
  Pressable,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
<<<<<<< HEAD
import ThemeImageBackground from './ThemeImageBackground';
import ThemedActionDialog from './PodcastActionDialog';
=======
import { Image, ImageBackground } from 'expo-image';
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayback } from './PlaybackContext';
<<<<<<< HEAD

import { useTheme, useThemeStyles } from '../themes/ThemeProvider';
import ThemePicker from '../themes/ThemePicker';

export default function SettingsScreen() {
  const { theme } = useTheme();
  const { styles, colors: COLORS } = useThemeStyles(createStyles, DEFAULT_COLORS);
  const [themePickerVisible, setThemePickerVisible] = useState(false);
  const [clearDialogVisible, setClearDialogVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const [statusMessage, setStatusMessage] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [batchProgress, setBatchProgress] = useState(null);
  const [isChoosingVideo, setIsChoosingVideo] = useState(false);
=======
import { getPodcastVideos, savePodcastVideos, pickPodcastCover } from './podcastVideoStorage';
import {
  pickAndSavePodcastVideos,
  pickAndReplacePodcastVideo,
  deleteVideoFile,
} from './videoFileService';

import settingsBackground from '../assets/Steampunk_Christmas_Music_Workshop.gif';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [statusMessage, setStatusMessage] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isChoosingVideo, setIsChoosingVideo] = useState(false);
  const [podcastVideos, setPodcastVideos] = useState([]);
  const [isChoosingPodcastVideos, setIsChoosingPodcastVideos] = useState(false);
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
  const scanInProgress = useRef(false);
  const {
    tracks,
    homeVideoName,
    changeHomeVideo,
    resetHomeVideo,
    musicFolderName,
    chooseMusicFolder,
    addAudioFiles,
<<<<<<< HEAD
    clearLibrary,
  } = usePlayback();

=======
  } = usePlayback();

  useEffect(() => {
    getPodcastVideos().then(setPodcastVideos);
  }, []);

  const choosePodcastVideos = async (existingVideo = null) => {
    if (isChoosingPodcastVideos) return;
    setIsChoosingPodcastVideos(true);
    setStatusMessage('Opening video picker...');
    try {
      if (existingVideo) {
        const replaced = await pickAndReplacePodcastVideo(existingVideo);
        if (!replaced) {
          setStatusMessage('No replacement video selected.');
          return;
        }
        const updatedVideos = podcastVideos.map((v) => (v.id === existingVideo.id ? replaced : v));
        await savePodcastVideos(updatedVideos);
        setPodcastVideos(updatedVideos);
        setStatusMessage(`Updated podcast video: ${replaced.name}`);
      } else {
        const newVideos = await pickAndSavePodcastVideos(true);
        if (!newVideos || !newVideos.length) {
          setStatusMessage('No podcast videos selected.');
          return;
        }
        const updatedVideos = [...podcastVideos, ...newVideos];
        await savePodcastVideos(updatedVideos);
        setPodcastVideos(updatedVideos);
        setStatusMessage(`Added ${newVideos.length} podcast ${newVideos.length === 1 ? 'video' : 'videos'}.`);
      }
    } catch (error) {
      setStatusMessage(error.message || 'Could not update podcast videos.');
    } finally {
      setIsChoosingPodcastVideos(false);
    }
  };

  const removePodcastVideo = (video) => {
    Alert.alert(
      'Remove Video',
      `Are you sure you want to delete "${video.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedVideos = podcastVideos.filter((item) => item.id !== video.id);
            try {
              await savePodcastVideos(updatedVideos);
              setPodcastVideos(updatedVideos);
              await deleteVideoFile(video.uri);
              if (video.coverUri) await deleteVideoFile(video.coverUri);
              setStatusMessage(`Removed podcast video: ${video.name}`);
            } catch (error) {
              setStatusMessage(error.message || 'Could not remove that podcast video.');
            }
          },
        },
      ]
    );
  };

  const changePodcastCover = async (video) => {
    if (isChoosingPodcastVideos) return;
    setIsChoosingPodcastVideos(true);
    try {
      const updated = await pickPodcastCover(video.id);
      if (updated) {
        setPodcastVideos(updated);
        setStatusMessage(`Cover updated for ${video.title || video.name}`);
      }
    } catch (error) {
      setStatusMessage(error.message || 'Could not save the podcast cover.');
    } finally {
      setIsChoosingPodcastVideos(false);
    }
  };

>>>>>>> 2376395559270ab40f72453a5475d22bec935705
  const handleChooseHomeVideo = async () => {
    if (isChoosingVideo) return;
    setIsChoosingVideo(true);
    setStatusMessage('Opening video picker...');
    try {
      const saved = await changeHomeVideo();
      if (!saved) {
        setStatusMessage('No home video selected.');
        return;
      }
      setStatusMessage(`Home video saved: ${saved.name}`);
    } catch (error) {
      setStatusMessage(error.message || 'Could not change the home video.');
    } finally {
      setIsChoosingVideo(false);
    }
  };

  const handleResetHomeVideo = async () => {
    try {
      await resetHomeVideo();
      setStatusMessage('Default home video restored.');
    } catch (error) {
      setStatusMessage(error.message || 'Could not restore the default home video.');
    }
  };

  const pickMusicFolder = async () => {
    if (scanInProgress.current) return;
    scanInProgress.current = true;
    setIsScanning(true);
<<<<<<< HEAD
    setBatchProgress(null);
    setStatusMessage('Please select your music folder.');
    try {
      const { trackCount, lyricResults } = await chooseMusicFolder((progressInfo) => {
        if (typeof progressInfo === 'string') {
          setStatusMessage(progressInfo);
        } else if (progressInfo?.message) {
          setStatusMessage(progressInfo.message);
          setBatchProgress(progressInfo);
        }
      });
      const songsLabel = trackCount === 1 ? 'song' : 'songs';
      if (lyricResults?.unavailable) {
        setStatusMessage(trackCount + ' ' + songsLabel + ' added. ' + lyricResults.message);
      } else if (lyricResults?.errors && !lyricResults?.processed) {
        setStatusMessage(trackCount + ' ' + songsLabel + ' added. Offline lyrics could not be generated. Open Lyrics on a song to try again.');
      } else if (lyricResults?.errors) {
        setStatusMessage(`${trackCount} ${songsLabel} added. Lyrics prepared for ${lyricResults.processed}; ${lyricResults.errors} could not be prepared.`);
      } else {
        setStatusMessage(`${trackCount} ${songsLabel} added. Lyrics prepared for ${lyricResults?.processed || 0}; ${lyricResults?.skipped || 0} already had lyrics.`);
      }
    } catch (error) {
      setStatusMessage(error.message || 'Could not load songs from this folder.');
    } finally {
      scanInProgress.current = false;
      setIsScanning(false);
      setBatchProgress(null);
=======
    setStatusMessage('Choose a folder and tap Use this folder. Your songs will sync automatically.');
    try {
      const { folderName, trackCount } = await chooseMusicFolder();
      setStatusMessage(folderName + ': ' + trackCount + (trackCount === 1 ? ' track synced.' : ' tracks synced.'));
    } catch (error) {
      setStatusMessage(error.message || 'Could not sync the selected music folder.');
    } finally {
      scanInProgress.current = false;
      setIsScanning(false);
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
    }
  };

  const addMusicFiles = async () => {
    if (scanInProgress.current) return;
    scanInProgress.current = true;
    setIsScanning(true);
<<<<<<< HEAD
    setBatchProgress(null);
    try {
      const result = await addAudioFiles((progressInfo) => {
        if (typeof progressInfo === 'string') {
          setStatusMessage(progressInfo);
        } else if (progressInfo?.message) {
          setStatusMessage(progressInfo.message);
          setBatchProgress(progressInfo);
        }
      });
      const trackCount = typeof result === 'object' && result !== null ? (result.count ?? result.trackCount ?? 0) : (Number(result) || 0);
      const lyricResults = typeof result === 'object' && result !== null ? result.lyricResults : null;
      const songsLabel = trackCount === 1 ? 'song' : 'songs';
      if (lyricResults?.unavailable) {
        setStatusMessage(trackCount + ' ' + songsLabel + ' added. ' + lyricResults.message);
      } else if (lyricResults?.errors && !lyricResults?.processed) {
        setStatusMessage(trackCount + ' ' + songsLabel + ' added. Offline lyrics could not be generated. Open Lyrics on a song to try again.');
      } else if (lyricResults?.errors) {
        setStatusMessage(`${trackCount} ${songsLabel} added. Lyrics prepared for ${lyricResults.processed}; ${lyricResults.errors} could not be prepared.`);
      } else {
        setStatusMessage(`${trackCount} ${songsLabel} added! Lyrics prepared for ${lyricResults?.processed || 0}; ${lyricResults?.skipped || 0} already had lyrics.`);
      }
    } catch (error) {
      setStatusMessage(error.message || 'Could not add songs.');
    } finally {
      scanInProgress.current = false;
      setIsScanning(false);
      setBatchProgress(null);
    }
  };

  const handleClearLibrary = () => setClearDialogVisible(true);
  const confirmClearLibrary = async () => {
    await clearLibrary();
    setStatusMessage('Library cleared. You can now choose a folder for a fresh start.');
  };

  return (
    <ThemeImageBackground source={theme.assets.settings} contentFit="cover" autoplay style={styles.background}>
=======
    try {
      const count = await addAudioFiles();
      setStatusMessage(count + (count === 1 ? ' track in your library.' : ' tracks in your library.'));
    } catch (error) {
      setStatusMessage(error.message || 'Could not add audio files.');
    } finally {
      scanInProgress.current = false;
      setIsScanning(false);
    }
  };

  return (
    <ImageBackground source={settingsBackground} contentFit="cover" autoplay style={styles.background}>
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
      <StatusBar barStyle="light-content" />
      <View style={styles.screen}>
        <View style={[styles.content, { paddingTop: insets.top + 8 }]}>
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to your library"
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="chevron-back" size={25} color={COLORS.cream} />
            </Pressable>
            <Text style={styles.heading}>Settings</Text>
            <View style={styles.headerGear}><Ionicons name="settings" size={23} color={COLORS.gold} /></View>
          </View>

<<<<<<< HEAD
          <Text style={styles.intro}>Your music, your mood.</Text>
=======
          <Text style={styles.intro}>Manage your music library.</Text>
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
          <View style={styles.ornamentDivider}>
            <View style={styles.ornamentLine} />
            <Text style={styles.ornamentText}>✦  ♫  ✦</Text>
            <View style={styles.ornamentLine} />
          </View>
          {statusMessage ? (
            <View accessibilityRole="text" style={styles.statusBox}>
              <Text style={styles.statusText}>{statusMessage}</Text>
            </View>
          ) : null}
        </View>

<<<<<<< HEAD
        {themePickerVisible && <ThemePicker onClose={() => setThemePickerVisible(false)} />}
=======
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
        <ScrollView
          style={styles.settingsScroll}
          contentContainerStyle={[styles.settingsScrollContent, { paddingBottom: Math.max(insets.bottom, 8) + 76 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.sectionBannerWrap}>
<<<<<<< HEAD
            <View style={styles.sectionBannerIcon}><Ionicons name="color-palette-outline" size={22} color={COLORS.gold} /></View>
            <Text style={styles.sectionBannerText}>Appearance</Text>
          </View>
          <View style={[styles.card, theme.id === 'default' && { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.surfaceBorder }]}>
            <Text style={styles.fieldLabel}>{theme.name} theme</Text>
            <Text style={styles.helperText}>Choose your backgrounds, Benjie, and welcome screen.</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Configure theme" onPress={() => setThemePickerVisible(true)}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <Ionicons name="color-palette-outline" size={20} color={COLORS.cream} />
              <Text style={styles.secondaryButtonText}>Configure theme</Text>
            </Pressable>
          </View>
          <View style={styles.sectionBannerWrap}>
            <View style={styles.sectionBannerIcon}><Ionicons name="musical-notes" size={22} color={COLORS.gold} /></View>
            <Text style={styles.sectionBannerText}>Music library</Text>
            <Ionicons name={theme.icon} size={16} color={COLORS.gold} style={styles.sectionBannerFlourish} />
          </View>
          <View style={[styles.card, theme.id === 'default' && { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.surfaceBorder }]}>
            <Text style={styles.fieldLabel}>{Platform.OS === 'android' ? 'Music folder' : 'Add music'}</Text>
            <Text style={styles.helperText}>
              {Platform.OS === 'android'
                ? musicFolderName ? `Current folder: ${musicFolderName}` : 'Choose the folder on your device where your songs are stored.'
                : 'Select songs from your device to add them to your library.'}
            </Text>
            <Text style={styles.helperText}>
              {Platform.OS === 'android'
                ? 'Tap below to select your folder. Your songs and lyrics will be set up automatically.'
                : 'Supported formats: MP3, M4A, WAV, AAC, OGG, and FLAC.'}
            </Text>
=======
            <View style={styles.sectionBannerIcon}><Ionicons name="musical-notes" size={22} color={COLORS.gold} /></View>
            <Text style={styles.sectionBannerText}>Music library</Text>
            <Ionicons name="snow" size={16} color={COLORS.gold} style={styles.sectionBannerFlourish} />
          </View>
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>{Platform.OS === 'android' ? 'Music folder' : 'Add music'}</Text>
            <Text style={styles.helperText}>
              {Platform.OS === 'android'
                ? musicFolderName ? `Folder: ${musicFolderName}` : 'Choose the folder where your songs are saved.'
                : 'Choose audio files from your phone, then they will be added to your library.'}
            </Text>
            <Text style={styles.helperText}>
              {Platform.OS === 'android'
                ? musicFolderName
                  ? 'Choose this folder again to sync any newly added songs automatically.'
                  : 'Tap Use this folder and allow access. Songs sync automatically.'
                : 'Supported formats: MP3, M4A, WAV, AAC, OGG, and FLAC.'}
            </Text>
            <Text style={styles.helperText}>Songs are copied into the app. Album tags group them into albums.</Text>
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
            {Platform.OS === 'android' ? (
              <Pressable
                accessibilityRole="button"
              disabled={isScanning}
                onPress={pickMusicFolder}
                style={({ pressed }) => [styles.secondaryButton, styles.folderButton, pressed && styles.pressed]}
              >
                <Ionicons name="folder-open-outline" size={19} color={COLORS.cream} />
<<<<<<< HEAD
                <Text style={styles.secondaryButtonText}>{isScanning ? 'Adding music...' : musicFolderName ? 'Change music folder' : 'Choose music folder'}</Text>
=======
                <Text style={styles.secondaryButtonText}>{isScanning ? 'Selecting / syncing music...' : musicFolderName ? 'Choose / sync music folder' : 'Choose music folder'}</Text>
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
              </Pressable>
            ) : null}
            {Platform.OS !== 'android' ? <Pressable
              accessibilityRole="button"
              disabled={isScanning}
              onPress={addMusicFiles}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Ionicons name={isScanning ? 'hourglass-outline' : 'refresh-outline'} size={19} color={COLORS.cream} />
<<<<<<< HEAD
              <Text style={styles.secondaryButtonText}>{isScanning ? 'Adding music...' : 'Add songs'}</Text>
            </Pressable> : null}
            {tracks.length > 0 && !isScanning ? (
              <Pressable
                accessibilityRole="button"
                onPress={handleClearLibrary}
                style={({ pressed }) => [styles.secondaryButton, styles.clearButton, pressed && styles.pressed]}
              >
                <Ionicons name="trash-outline" size={17} color={COLORS.cream} />
                <Text style={styles.secondaryButtonText}>Clear library & start fresh</Text>
              </Pressable>
            ) : null}
            {isScanning && (
              <View style={styles.batchBox}>
                <View style={styles.batchRow}>
                  <ActivityIndicator size="small" color={COLORS.green} />
                  <Text style={styles.batchTitle}>
                    {batchProgress?.stage === 'transcribing' && batchProgress?.total
                      ? `Getting lyrics ready (${batchProgress.current} of ${batchProgress.total})`
                      : 'Adding songs to library...'}
                  </Text>
                </View>
                {batchProgress?.track?.title ? (
                  <Text numberOfLines={1} style={styles.batchTrackName}>
                    ♫ {batchProgress.track.title}
                  </Text>
                ) : null}
                {batchProgress?.total ? (
                  <View style={styles.batchProgressTrack}>
                    <View
                      style={[
                        styles.batchProgressFill,
                        {
                          width: `${Math.round(
                            Math.min(
                              100,
                              Math.max(
                                5,
                                (((batchProgress.current - 1) + (batchProgress.progress || 0)) / batchProgress.total) * 100
                              )
                            )
                          )}%`,
                        },
                      ]}
                    />
                  </View>
                ) : null}
                <Text style={styles.batchNote}>
                  Getting lyrics ready now so you can see them instantly while playing.
                </Text>
              </View>
            )}
            <Text style={styles.helperText}>{tracks.length} {tracks.length === 1 ? 'song' : 'songs'} in your library.</Text>
=======
              <Text style={styles.secondaryButtonText}>{isScanning ? 'Adding music...' : 'Add audio files'}</Text>
            </Pressable> : null}
            <Text style={styles.helperText}>{tracks.length} playable {tracks.length === 1 ? 'track' : 'tracks'} in your library.</Text>
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
          </View>

          {Platform.OS !== 'web' ? (
            <>
              <View style={styles.sectionBannerWrap}>
                <View style={styles.sectionBannerIcon}><Ionicons name="videocam" size={22} color={COLORS.gold} /></View>
                <Text style={styles.sectionBannerText}>Home screen video</Text>
<<<<<<< HEAD
                <Ionicons name={theme.icon} size={16} color={COLORS.gold} style={styles.sectionBannerFlourish} />
              </View>
              <View style={[styles.card, theme.id === 'default' && { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.surfaceBorder }]}>
=======
                <Ionicons name="snow" size={16} color={COLORS.gold} style={styles.sectionBannerFlourish} />
              </View>
              <View style={styles.card}>
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
                <Text style={styles.fieldLabel}>Current video</Text>
                <Text style={styles.helperText} numberOfLines={1}>{homeVideoName}</Text>
                <Text style={styles.helperText}>Choose a video from your device. It will play on Home when no song is playing.</Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={isChoosingVideo}
                  onPress={handleChooseHomeVideo}
                  style={({ pressed }) => [styles.secondaryButton, styles.folderButton, pressed && styles.pressed]}
                >
                  <Ionicons name="videocam-outline" size={19} color={COLORS.cream} />
                  <Text style={styles.secondaryButtonText}>{isChoosingVideo ? 'Opening videos...' : 'Choose home video'}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleResetHomeVideo}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                >
                  <Ionicons name="refresh-outline" size={19} color={COLORS.cream} />
                  <Text style={styles.secondaryButtonText}>Restore default video</Text>
                </Pressable>
              </View>

              <View style={styles.sectionBannerWrap}>
                <View style={styles.sectionBannerIcon}><Ionicons name="film" size={22} color={COLORS.gold} /></View>
                <Text style={styles.sectionBannerText}>Podcast videos</Text>
<<<<<<< HEAD
                <Ionicons name={theme.icon} size={16} color={COLORS.gold} style={styles.sectionBannerFlourish} />
              </View>
              <View style={[styles.card, theme.id === 'default' && { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.surfaceBorder }]}>
                <Text style={styles.fieldLabel}>Your podcast collection</Text>
                <Text style={styles.helperText}>Create a podcast with a title and description, then choose its videos in episode order.</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/podcast-create')}
                  style={({ pressed }) => [styles.secondaryButton, styles.folderButton, pressed && styles.pressed]}
                >
                  <Ionicons name="add-circle-outline" size={19} color={COLORS.cream} />
                  <Text style={styles.secondaryButtonText}>Add podcast videos</Text>
                </Pressable>

=======
                <Ionicons name="snow" size={16} color={COLORS.gold} style={styles.sectionBannerFlourish} />
              </View>
              <View style={styles.card}>
                <Text style={styles.fieldLabel}>Your podcast collection</Text>
                <Text style={styles.helperText}>Add videos here. They will appear in the Podcast list.</Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={isChoosingPodcastVideos}
                  onPress={() => choosePodcastVideos()}
                  style={({ pressed }) => [styles.secondaryButton, styles.folderButton, pressed && styles.pressed, isChoosingPodcastVideos && styles.disabled]}
                >
                  <Ionicons name="add-circle-outline" size={19} color={COLORS.cream} />
                  <Text style={styles.secondaryButtonText}>{isChoosingPodcastVideos ? 'Opening videos...' : 'Add podcast videos'}</Text>
                </Pressable>
                {podcastVideos.length ? (
                  <View style={styles.podcastVideoList}>
                    {podcastVideos.map((video) => (
                      <View key={video.id} style={styles.podcastVideoRow}>
                        <View style={[styles.podcastVideoIcon, { overflow: 'hidden' }]}>{video.coverUri ? <Image source={{ uri: video.coverUri }} contentFit="cover" style={StyleSheet.absoluteFill} /> : <Ionicons name="videocam" size={18} color={COLORS.gold} />}</View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text numberOfLines={1} style={styles.podcastVideoName}>{video.title || video.name}</Text>
                          <Pressable accessibilityRole="button" accessibilityLabel={`Edit cover for ${video.title || video.name}`} disabled={isChoosingPodcastVideos} onPress={() => changePodcastCover(video)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 }}>
                            <Ionicons name="image-outline" size={14} color={COLORS.green} />
                            <Text style={{ color: COLORS.green, fontFamily: 'NunitoBold', fontSize: 12 }}>{video.coverUri ? 'Change cover' : 'Add cover'}</Text>
                          </Pressable>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Replace ${video.name}`}
                          disabled={isChoosingPodcastVideos}
                          onPress={() => choosePodcastVideos(video)}
                          style={styles.podcastVideoAction}
                        >
                          <Ionicons name="create-outline" size={19} color={COLORS.green} />
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${video.name}`}
                          onPress={() => removePodcastVideo(video)}
                          style={styles.podcastVideoAction}
                        >
                          <Ionicons name="trash-outline" size={18} color={COLORS.red} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.helperText}>No podcast videos added yet.</Text>
                )}
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
              </View>
            </>
          ) : null}

        </ScrollView>

<<<<<<< HEAD
        <View style={[styles.bottomBar, theme.id === 'default' && { backgroundColor: theme.colors.surfaceRaised, borderTopColor: theme.colors.surfaceBorder }, { paddingBottom: Math.max(insets.bottom, 8) }]}>
=======
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
          {[
            { label: 'Home', icon: 'home' },
            { label: 'Search', icon: 'search' },
            { label: 'Your Library', icon: 'library' },
            { label: 'Settings', icon: 'settings' },
          ].map((tab) => {
            const selected = tab.label === 'Settings';
            return (
              <Pressable
                key={tab.label}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  if (tab.label === 'Home') router.replace('/Music');
                  if (tab.label === 'Search') router.replace('/Search');
                  if (tab.label === 'Your Library') router.replace('/Library');
                  if (tab.label === 'Settings') router.replace('/Settings');
                }}
                style={styles.navItem}
              >
                <Ionicons
                  name={selected ? tab.icon : `${tab.icon}-outline`}
                  size={21}
<<<<<<< HEAD
                  color={theme.id === 'default' ? (selected ? theme.colors.cream : theme.colors.onSurfaceMuted) : selected ? COLORS.red : COLORS.ink}
                />
                <Text style={[styles.navLabel, selected && styles.navLabelSelected, theme.id === 'default' && { color: theme.colors.cream }]}>{tab.label}</Text>
=======
                  color={selected ? COLORS.red : COLORS.ink}
                />
                <Text style={[styles.navLabel, selected && styles.navLabelSelected]}>{tab.label}</Text>
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
              </Pressable>
            );
          })}
        </View>

      </View>
<<<<<<< HEAD
      <ThemedActionDialog visible={clearDialogVisible} title="Start fresh?"
        message="Clear imported songs and cached lyrics from MistleTunes to make room for a fresh collection."
        icon="trash-outline" destructive confirmLabel="Clear library"
        onConfirm={confirmClearLibrary} onClose={() => setClearDialogVisible(false)}>
        <View style={{ marginTop: 18, padding: 14, gap: 10, borderRadius: 16, backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.surfaceBorder, borderWidth: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
            <Ionicons name="musical-notes-outline" size={19} color={theme.colors.gold} />
            <Text style={{ flex: 1, color: theme.colors.cream, fontFamily: 'NunitoBold', fontSize: 13 }}>{tracks.length} {tracks.length === 1 ? 'song' : 'songs'} in your library</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 9 }}>
            <Ionicons name="shield-checkmark-outline" size={19} color={theme.colors.gold} />
            <Text style={{ flex: 1, color: theme.colors.onSurfaceMuted, fontFamily: 'NunitoRegular', fontSize: 12, lineHeight: 18 }}>Your original music folder and files on your phone stay safe.</Text>
          </View>
        </View>
      </ThemedActionDialog>
    </ThemeImageBackground>
  );
}

const DEFAULT_COLORS = {
=======
    </ImageBackground>
  );
}

const COLORS = {
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
  green: '#07502c',
  red: '#a20d1b',
  gold: '#f2bb4f',
  ink: '#24180d',
  muted: '#624a2e',
  cream: '#fff0c9',
  line: '#b88232',
};

<<<<<<< HEAD
const createStyles = (COLORS) => StyleSheet.create({
=======
const styles = StyleSheet.create({
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
  background: { flex: 1, width: '100%' },
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 20 },
  settingsScroll: { flex: 1, marginHorizontal: 20, overflow: 'hidden' },
  settingsScrollContent: { paddingBottom: 84 },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingTop: 8, backgroundColor: COLORS.cream, borderTopWidth: 2, borderTopColor: COLORS.gold },
  navItem: { flex: 1, minWidth: 0, alignItems: 'center', gap: 1 },
  navLabel: { color: COLORS.ink, fontFamily: 'NunitoSemiBold', fontSize: 10 },
  navLabelSelected: { color: COLORS.red, fontFamily: 'NunitoExtraBold' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 5, marginTop: 24 },
  backButton: { width: 34, height: 36, justifyContent: 'center', marginRight: 4 },
  heading: { flex: 1, color: COLORS.cream, fontFamily: 'NunitoExtraBold', fontSize: 28, textShadowColor: COLORS.gold, textShadowRadius: 7 },
<<<<<<< HEAD
  headerGear: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23, backgroundColor: COLORS.surfaceDeep, borderWidth: 2, borderColor: COLORS.gold, shadowColor: COLORS.gold, shadowOpacity: 0.65, shadowRadius: 7, elevation: 3 },
=======
  headerGear: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23, backgroundColor: 'rgba(0,34,18,0.8)', borderWidth: 2, borderColor: COLORS.gold, shadowColor: COLORS.gold, shadowOpacity: 0.65, shadowRadius: 7, elevation: 3 },
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
  intro: { color: COLORS.cream, fontFamily: 'NunitoSemiBold', fontSize: 14, textAlign: 'center', marginBottom: 5, textShadowColor: 'rgba(0,0,0,0.75)', textShadowRadius: 4 },
  ornamentDivider: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 10 },
  ornamentLine: { flex: 1, height: 1.5, backgroundColor: COLORS.gold },
  ornamentText: { color: COLORS.gold, fontFamily: 'NunitoExtraBold', fontSize: 16, textShadowColor: COLORS.gold, textShadowRadius: 6 },
  sectionBannerWrap: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 13, marginTop: 2, marginBottom: -17, zIndex: 2 },
  sectionBannerIcon: { position: 'absolute', left: 0, zIndex: 1, width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 28, borderWidth: 2, borderColor: COLORS.gold, backgroundColor: COLORS.red, shadowColor: COLORS.gold, shadowOpacity: 0.6, shadowRadius: 7, elevation: 4 },
  sectionBannerText: { flex: 1, color: COLORS.cream, fontFamily: 'NunitoExtraBold', fontSize: 17, textAlign: 'center', paddingHorizontal: 50, paddingVertical: 10, borderRadius: 24, borderWidth: 2, borderColor: COLORS.gold, backgroundColor: COLORS.red, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },
  sectionBannerFlourish: { position: 'absolute', right: 10, color: COLORS.gold, fontSize: 17, textShadowColor: COLORS.gold, textShadowRadius: 6 },
  card: { paddingHorizontal: 17, paddingTop: 29, paddingBottom: 17, borderRadius: 23, borderWidth: 2, borderColor: COLORS.gold, backgroundColor: COLORS.cream, shadowColor: COLORS.gold, shadowOpacity: 0.42, shadowRadius: 9, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  fieldLabel: { color: COLORS.ink, fontFamily: 'NunitoExtraBold', fontSize: 14, marginBottom: 4 },
  input: { minHeight: 38, paddingVertical: 5, color: COLORS.ink, fontFamily: 'NunitoSemiBold', fontSize: 14 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.line, marginVertical: 7 },
  helperText: { color: COLORS.ink, fontFamily: 'NunitoRegular', fontSize: 12, lineHeight: 17, marginTop: 3, marginBottom: 8 },
  disabled: { opacity: 0.6 },
<<<<<<< HEAD
  secondaryButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 12, borderWidth: 2, borderColor: COLORS.gold, borderRadius: 24, backgroundColor: COLORS.green, shadowColor: COLORS.gold, shadowOpacity: 0.32, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  folderButton: { marginBottom: 10 },
  clearButton: { backgroundColor: COLORS.red, marginBottom: 10 },
  secondaryButtonText: { color: COLORS.cream, fontFamily: 'NunitoExtraBold', fontSize: 13 },
  statusBox: { marginTop: 10, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.gold, backgroundColor: COLORS.cream },
  statusText: { color: COLORS.green, fontFamily: 'NunitoSemiBold', fontSize: 12 },
  batchBox: { marginTop: 12, marginBottom: 8, padding: 14, borderRadius: 16, borderWidth: 1.5, borderColor: COLORS.gold, backgroundColor: '#fcf6e6' },
  batchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  batchTitle: { color: COLORS.green, fontFamily: 'NunitoExtraBold', fontSize: 13, flex: 1 },
  batchTrackName: { color: COLORS.ink, fontFamily: 'NunitoBold', fontSize: 13, marginTop: 8, marginLeft: 2 },
  batchProgressTrack: { height: 7, borderRadius: 4, backgroundColor: COLORS.surfaceTint, overflow: 'hidden', marginTop: 10 },
  batchProgressFill: { height: '100%', backgroundColor: COLORS.green, borderRadius: 4 },
  batchNote: { color: COLORS.muted, fontFamily: 'NunitoRegular', fontSize: 11, lineHeight: 15, marginTop: 8 },
=======
  podcastVideoList: { gap: 7, marginTop: 2 },
  podcastVideoRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 8, borderRadius: 12, backgroundColor: 'rgba(7,80,44,0.08)' },
  podcastVideoIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: COLORS.green },
  podcastVideoName: { flex: 1, minWidth: 0, color: COLORS.ink, fontFamily: 'NunitoSemiBold', fontSize: 12 },
  podcastVideoAction: { width: 32, height: 38, alignItems: 'center', justifyContent: 'center' },
  secondaryButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 12, borderWidth: 2, borderColor: COLORS.gold, borderRadius: 24, backgroundColor: COLORS.green, shadowColor: COLORS.gold, shadowOpacity: 0.32, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  folderButton: { marginBottom: 10 },
  secondaryButtonText: { color: COLORS.cream, fontFamily: 'NunitoExtraBold', fontSize: 13 },
  statusBox: { marginTop: 10, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.gold, backgroundColor: COLORS.cream },
  statusText: { color: COLORS.green, fontFamily: 'NunitoSemiBold', fontSize: 12 },
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
  pressed: { opacity: 0.82 },
});
