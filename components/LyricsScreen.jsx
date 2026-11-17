import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_SYNC_OFFSET_MS, clampSyncOffset } from './karaokeTiming';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayback } from './PlaybackContext';
import SongArtwork from './SongArtwork';
import { loadLyrics, importLyrics, removeLyrics } from './lyricsStorage';
import { readGeneratedLyrics, deleteGeneratedLyrics, getInMemoryLyrics } from './generatedLyricsCache';
import SyncedLyricsView from './SyncedLyricsView';
import { importedSegments } from './syncedLyricsUtils';
import { useThemeStyles } from '../themes/ThemeProvider';
import { getOfflineLyricsStatus, transcribeOffline } from './offlineLyrics';

const timeLabel = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
export default function LyricsScreen({ onClose }) {
  const playback = usePlayback();
  return <Modal visible animationType="slide" onRequestClose={onClose}>
    <LyricsContent key={`${playback.libraryId}:${playback.currentTrack?.id}`} {...playback} onClose={onClose} />
  </Modal>;
}

function LyricsContent({ currentTrack: track, libraryId, player, currentTime, duration, playing, togglePlayback, seekTo, lyricsRevision, onClose }) {
  const { styles, colors: COLORS } = useThemeStyles(createStyles, BASE_COLORS);
  const insets = useSafeAreaInsets();
  const initialLyrics = track && libraryId ? getInMemoryLyrics(libraryId, track.id) : null;
  const timingKey = 'music-player.lyric-offset-ms:' + libraryId + ':' + track?.id;
  const [syncOffset, setSyncOffset] = useState(DEFAULT_SYNC_OFFSET_MS);
  const [lyrics, setLyrics] = useState(initialLyrics);
  const [busy, setBusy] = useState(!initialLyrics);
  const [error, setError] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeStage, setTranscribeStage] = useState('');
  const [transcribeProgress, setTranscribeProgress] = useState(0);
  const [seekWidth, setSeekWidth] = useState(0);
  const [previewPosition, setPreviewPosition] = useState(null);
  const mounted = useRef(true);
  const previewTimeout = useRef(null);
  const seekOrigin = useRef(null);
  const seekRequest = useRef(0);
  const displayedTime = previewPosition ?? currentTime;

  useEffect(() => {
    mounted.current = true;
    void (async () => {
      try {
        if (!track || !libraryId) return;
        const savedOffset = await AsyncStorage.getItem(timingKey);
        if (mounted.current && savedOffset !== null) setSyncOffset(clampSyncOffset(Number(savedOffset)));
        const manual = await loadLyrics(libraryId, track.id);
        const saved = manual && !manual.generated ? manual : await readGeneratedLyrics(track, libraryId);
        if (mounted.current) { setLyrics(saved); setBusy(false); }
        if ((!manual || manual.generated) && !saved && (await getOfflineLyricsStatus()).ready) {
          if (mounted.current) {
            setIsTranscribing(true);
            setTranscribeStage('Syncing word timing…');
          }
          try {
            await transcribeOffline(track, {
              libraryId,
              onStage: (stage) => mounted.current && setTranscribeStage(stage),
              onProgress: (progress) => mounted.current && setTranscribeProgress(progress),
            });
            const updated = await readGeneratedLyrics(track, libraryId);
            if (mounted.current && updated) setLyrics(updated);
          } finally {
            if (mounted.current) setIsTranscribing(false);
          }
        }
      } catch (err) { if (mounted.current) setError(err.message); }
      finally { if (mounted.current) setBusy(false); }
    })();
    return () => { mounted.current = false; clearTimeout(previewTimeout.current); };
  }, [libraryId, track, lyricsRevision, timingKey]);

  useEffect(() => {
    if (previewPosition !== null && currentTime !== seekOrigin.current && Math.abs(currentTime - previewPosition) < 0.75) {
      const timeout = setTimeout(() => setPreviewPosition(null), 0);
      return () => clearTimeout(timeout);
    }
  }, [currentTime, previewPosition]);

  const seek = useCallback(async (seconds) => {
    const request = ++seekRequest.current;
    const target = Math.max(0, Math.min(duration || seconds, seconds));
    seekOrigin.current = currentTime;
    setPreviewPosition(target); // Highlight changes immediately, before native status returns.
    clearTimeout(previewTimeout.current);
    previewTimeout.current = setTimeout(() => { if (mounted.current) setPreviewPosition(null); }, 4000);
    try {
      await seekTo(target);
    } catch (err) {
      if (mounted.current) setError(err.message || 'Could not seek to this lyric.');
    } finally {
      if (mounted.current && request === seekRequest.current) {
        clearTimeout(previewTimeout.current);
        setPreviewPosition(null);
      }
    }
  }, [currentTime, duration, seekTo]);

  const handleTranscribeNow = async () => {
    if (isTranscribing || !track || !libraryId) return;
    setIsTranscribing(true);
    setError(null);
    try {
      const options = {
        libraryId,
        force: true,
        onStage: (stage) => mounted.current && setTranscribeStage(stage),
        onProgress: (p) => mounted.current && setTranscribeProgress(p),
      };
      await transcribeOffline(track, options);
      const result = await readGeneratedLyrics(track, libraryId);
      if (mounted.current && result) {
        setLyrics(result);
      }
    } catch (err) {
      if (mounted.current) setError(err.message || 'Offline lyrics generation failed.');
    } finally {
      if (mounted.current) setIsTranscribing(false);
    }
  };

  const changeSyncOffset = async (value) => {
    const next = clampSyncOffset(value);
    setSyncOffset(next);
    try { await AsyncStorage.setItem(timingKey, String(next)); }
    catch { if (mounted.current) setError('Could not save the lyrics timing adjustment.'); }
  };

  const replace = async () => {
    try {
      const saved = await importLyrics(libraryId, track?.id);
      if (saved && mounted.current) { setLyrics(saved); setError(null); }
    } catch (err) { if (mounted.current) setError(err.message); }
  };

  const remove = async () => {
    try {
      await removeLyrics(libraryId, track.id);
      await deleteGeneratedLyrics(track, libraryId);
      if (mounted.current) setLyrics(null);
    } catch (err) { if (mounted.current) setError(err.message); }
  };

  const segments = useMemo(() => lyrics?.segments ?? (lyrics?.synced ? importedSegments(lyrics.lines, duration) : null), [lyrics, duration]);

  return <View style={[styles.screen, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
    <View style={styles.header}>
      <SongArtwork source={track?.artwork} style={styles.artwork} />
      <View style={styles.heading}><Text style={styles.title} numberOfLines={2}>{track?.title || 'Lyrics'}</Text><Text style={styles.artist}>{track?.artist || 'Unknown artist'}</Text></View>
      <Pressable accessibilityLabel="Close lyrics" onPress={onClose} hitSlop={12}><Ionicons name="close-circle" size={36} color="#fff5d7" /></Pressable>
    </View>
    <View style={styles.toolbar}>
      <Text style={styles.badge}><Ionicons name="musical-notes-outline" size={12} /> Lyrics</Text>
      {lyrics?.generated && <Pressable accessibilityRole="button" accessibilityLabel="Re-sync lyrics from this audio file" disabled={isTranscribing || busy} onPress={handleTranscribeNow}><Text style={styles.action}>Re-sync</Text></Pressable>}
      <Pressable onPress={replace}><Text style={styles.action}>{lyrics ? 'Replace' : 'Import'}</Text></Pressable>
      {lyrics && <Pressable onPress={remove} accessibilityLabel="Remove lyrics"><Ionicons name="trash-outline" size={18} color="#e8d28a" /></Pressable>}
    </View>
    {segments?.length > 0 && <View style={styles.syncControls}>
      <Pressable accessibilityRole="button" accessibilityLabel="Show lyrics 250 milliseconds earlier" onPress={() => changeSyncOffset(syncOffset - 250)} style={styles.syncButton}><Text style={styles.action}>Earlier</Text></Pressable>
      <Text style={styles.syncLabel}>{'Timing: ' + (Math.abs(syncOffset) / 1000).toFixed(2) + 's ' + (syncOffset < 0 ? 'earlier' : 'later')}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Show lyrics 250 milliseconds later" onPress={() => changeSyncOffset(syncOffset + 250)} style={styles.syncButton}><Text style={styles.action}>Later</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Reset lyrics timing" onPress={() => changeSyncOffset(DEFAULT_SYNC_OFFSET_MS)} style={styles.syncButton}><Text style={styles.action}>Reset</Text></Pressable>
    </View>}
    {error && <Text style={styles.error}>{error}</Text>}
    {busy ? <View style={styles.empty}><ActivityIndicator color="#f4d683" /></View>
      : isTranscribing ? (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color="#f4d683" />
          <Text style={styles.emptyTitle}>Getting lyrics ready…</Text>
          <Text style={styles.note}>{transcribeStage || 'Listening to song…'}</Text>
          <View style={styles.transcribeProgressBg}>
            <View style={[styles.transcribeProgressFill, { width: `${Math.round(transcribeProgress * 100)}%` }]} />
          </View>
        </View>
      ) : segments?.length ? <SyncedLyricsView segments={segments} player={player} currentTime={currentTime} previewPosition={previewPosition} syncOffset={syncOffset} onSeek={seek} />
        : lyrics?.lines?.length ? <ScrollView><Text style={styles.note}>These lyrics do not follow along with playback.</Text>{lyrics.lines.map((line, index) => <Text key={index} style={styles.plain}>{line.text}</Text>)}</ScrollView>
          : <View style={styles.empty}>
              <Ionicons name="musical-notes-outline" size={52} color="#efcf76" />
              <Text style={styles.emptyTitle}>{lyrics?.generated ? 'No singing found' : 'No lyrics yet'}</Text>
              <Text style={styles.note}>
                {lyrics?.generated
                  ? 'No vocals were detected in this song.'
                  : 'Lyrics are prepared automatically when you add music, or you can import a lyrics file anytime.'}
              </Text>
              {!lyrics?.generated ? (
                <Pressable accessibilityRole="button" style={styles.transcribeButton} onPress={handleTranscribeNow}>
                  <Ionicons name="sparkles" size={18} color={COLORS.green} />
                  <Text style={styles.transcribeButtonText}>Generate offline lyrics</Text>
                </Pressable>
              ) : null}
            </View>}
    {lyrics?.generated && <Text style={styles.disclaimer}>Auto-generated lyrics may occasionally differ from the original song.</Text>}
    <Pressable accessibilityRole="adjustable" accessibilityLabel="Song position" accessibilityValue={{ min: 0, max: duration, now: displayedTime }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={({ nativeEvent }) => seek(displayedTime + (nativeEvent.actionName === 'increment' ? 5 : -5))}
      onLayout={({ nativeEvent }) => setSeekWidth(nativeEvent.layout.width)}
      onPress={({ nativeEvent }) => { if (seekWidth && duration) seek(nativeEvent.locationX / seekWidth * duration); }} style={styles.seekTouch}>
      <View style={styles.seekTrack}><View style={[styles.seekFill, { width: `${Math.min(100, duration ? displayedTime / duration * 100 : 0)}%` }]} /></View>
    </Pressable>
    <View style={styles.times}><Text style={styles.time}>{timeLabel(displayedTime)}</Text><Text style={styles.time}>{timeLabel(duration)}</Text></View>
    <Pressable style={styles.play} onPress={togglePlayback} accessibilityLabel={playing ? 'Pause' : 'Play'}><Ionicons name={playing ? 'pause' : 'play'} size={32} color={COLORS.greenPanelAlt} /></Pressable>
  </View>;
}
const BASE_COLORS = {
  green: '#153f2e',
  greenPanelAlt: '#123e2d',
  moss: '#c9d8c2',
};

const createStyles = (colors) => StyleSheet.create({
  syncControls: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 },
  syncButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  syncLabel: { color: '#fff5d7', fontSize: 11 },
  screen: { flex: 1, backgroundColor: colors.green, paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 }, artwork: { width: 60, height: 60, borderRadius: 10 },
  heading: { flex: 1 }, title: { color: '#fff5d7', fontSize: 19, fontWeight: '800' }, artist: { color: colors.moss, marginTop: 4 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 20, marginBottom: 8 },
  badge: { flex: 1, color: '#d9c57e', fontSize: 12, fontWeight: '700' }, action: { color: '#f0d586', fontWeight: '700' },
  error: { color: '#ffbba7', paddingVertical: 12 }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  emptyTitle: { color: '#fff6d9', fontSize: 22, fontWeight: '800', textAlign: 'center' }, note: { color: colors.moss, lineHeight: 22, textAlign: 'center', paddingHorizontal: 12 },
  plain: { color: '#fff6d9', fontSize: 28, lineHeight: 42, fontWeight: '700', marginTop: 14 },
  disclaimer: { color: colors.moss, fontSize: 11, textAlign: 'center', marginVertical: 8 },
  seekTouch: { paddingVertical: 14 }, seekTrack: { height: 4, backgroundColor: colors.surfaceRaised, borderRadius: 2 }, seekFill: { height: 4, backgroundColor: '#fff4d2', borderRadius: 2 },
  times: { flexDirection: 'row', justifyContent: 'space-between' }, time: { color: '#ced6be', fontSize: 12 },
  play: { alignSelf: 'center', width: 68, height: 68, borderRadius: 34, backgroundColor: '#fff5d7', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  transcribeProgressBg: { width: '80%', height: 6, backgroundColor: colors.surface, borderRadius: 3, overflow: 'hidden', marginTop: 10 },
  transcribeProgressFill: { height: '100%', backgroundColor: '#f4d683' },
  transcribeButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f4d683', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 22, marginTop: 10 },
  transcribeButtonText: { color: colors.green, fontWeight: '800', fontSize: 14 },
});
