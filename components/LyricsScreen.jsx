import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayback } from './PlaybackContext';
import SongArtwork from './SongArtwork';
import { loadLyrics, importLyrics, removeLyrics } from './lyricsStorage';
import { readGeneratedLyrics, deleteGeneratedLyrics } from './generatedLyricsCache';
import SyncedLyricsView from './SyncedLyricsView';
import { importedSegments } from './syncedLyricsUtils';

const timeLabel = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
export default function LyricsScreen({ onClose }) {
  const playback = usePlayback();
  return <Modal visible animationType="slide" onRequestClose={onClose}>
    <LyricsContent key={`${playback.libraryId}:${playback.currentTrack?.id}`} {...playback} onClose={onClose} />
  </Modal>;
}

function LyricsContent({ currentTrack: track, libraryId, currentTime, duration, playing, togglePlayback, seekTo, lyricsRevision, onClose }) {
  const insets = useSafeAreaInsets();
  const [lyrics, setLyrics] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(null);
  const [seekWidth, setSeekWidth] = useState(0);
  const [previewPosition, setPreviewPosition] = useState(null);
  const mounted = useRef(true);
  const previewTimeout = useRef(null);
  const seekOrigin = useRef(null);
  const displayedTime = previewPosition ?? currentTime;
  useEffect(() => {
    mounted.current = true;
    void (async () => {
      try {
        if (!track || !libraryId) return;
        const manual = await loadLyrics(libraryId, track.id);
        const saved = manual && !manual.generated ? manual : await readGeneratedLyrics(track, libraryId);
        if (mounted.current) setLyrics(saved);
      } catch (err) { if (mounted.current) setError(err.message); }
      finally { if (mounted.current) setBusy(false); }
    })();
    return () => { mounted.current = false; clearTimeout(previewTimeout.current); };
  }, [libraryId, track, lyricsRevision]);
  useEffect(() => {
    if (previewPosition !== null && currentTime !== seekOrigin.current && Math.abs(currentTime - previewPosition) < 0.75) {
      const timeout = setTimeout(() => setPreviewPosition(null), 0);
      return () => clearTimeout(timeout);
    }
  }, [currentTime, previewPosition]);
  const seek = (seconds) => {
    const target = Math.max(0, Math.min(duration || seconds, seconds));
    seekOrigin.current = currentTime;
    setPreviewPosition(target); // Highlight changes immediately, before native status returns.
    seekTo(target);
    clearTimeout(previewTimeout.current);
    previewTimeout.current = setTimeout(() => { if (mounted.current) setPreviewPosition(null); }, 4000);
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
  const segments = lyrics?.segments ?? (lyrics?.synced ? importedSegments(lyrics.lines, duration) : null);
  return <View style={[styles.screen, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
    <View style={styles.header}>
      <SongArtwork source={track?.artwork} style={styles.artwork} />
      <View style={styles.heading}><Text style={styles.title} numberOfLines={2}>{track?.title || 'Lyrics'}</Text><Text style={styles.artist}>{track?.artist || 'Unknown artist'}</Text></View>
      <Pressable accessibilityLabel="Close lyrics" onPress={onClose} hitSlop={12}><Ionicons name="close-circle" size={36} color="#fff5d7" /></Pressable>
    </View>
    <View style={styles.toolbar}>
      <Text style={styles.badge}><Ionicons name="phone-portrait-outline" size={12} /> Offline lyrics</Text>
      <Pressable onPress={replace}><Text style={styles.action}>{lyrics ? 'Replace' : 'Import'}</Text></Pressable>
      {lyrics && <Pressable onPress={remove} accessibilityLabel="Remove lyrics"><Ionicons name="trash-outline" size={18} color="#e8d28a" /></Pressable>}
    </View>
    {error && <Text style={styles.error}>{error}</Text>}
    {busy ? <View style={styles.empty}><ActivityIndicator color="#f4d683" /></View>
      : segments?.length ? <SyncedLyricsView segments={segments} currentTime={displayedTime} onSeek={seek} />
        : lyrics?.lines?.length ? <ScrollView><Text style={styles.note}>These lyrics have no timestamps.</Text>{lyrics.lines.map((line, index) => <Text key={index} style={styles.plain}>{line.text}</Text>)}</ScrollView>
          : <View style={styles.empty}><Ionicons name="musical-notes-outline" size={52} color="#efcf76" /><Text style={styles.emptyTitle}>{lyrics?.generated ? 'No vocals detected' : 'No lyrics saved yet'}</Text><Text style={styles.note}>{lyrics?.generated ? 'Whisper found no timed vocal lines in this song.' : 'Selecting a local song generates lyrics before playback in the rebuilt app. You can also import an LRC or TXT file.'}</Text></View>}
    {lyrics?.generated && <Text style={styles.disclaimer}>Generated on this device. Words and timing may be inaccurate for singing.</Text>}
    <Pressable accessibilityRole="adjustable" accessibilityLabel="Song position" accessibilityValue={{ min: 0, max: duration, now: displayedTime }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={({ nativeEvent }) => seek(displayedTime + (nativeEvent.actionName === 'increment' ? 5 : -5))}
      onLayout={({ nativeEvent }) => setSeekWidth(nativeEvent.layout.width)}
      onPress={({ nativeEvent }) => { if (seekWidth && duration) seek(nativeEvent.locationX / seekWidth * duration); }} style={styles.seekTouch}>
      <View style={styles.seekTrack}><View style={[styles.seekFill, { width: `${Math.min(100, duration ? displayedTime / duration * 100 : 0)}%` }]} /></View>
    </Pressable>
    <View style={styles.times}><Text style={styles.time}>{timeLabel(displayedTime)}</Text><Text style={styles.time}>{timeLabel(duration)}</Text></View>
    <Pressable style={styles.play} onPress={togglePlayback} accessibilityLabel={playing ? 'Pause' : 'Play'}><Ionicons name={playing ? 'pause' : 'play'} size={32} color="#123e2d" /></Pressable>
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#153f2e', paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 }, artwork: { width: 60, height: 60, borderRadius: 10 },
  heading: { flex: 1 }, title: { color: '#fff5d7', fontSize: 19, fontWeight: '800' }, artist: { color: '#c9d8c2', marginTop: 4 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 20, marginBottom: 8 },
  badge: { flex: 1, color: '#d9c57e', fontSize: 12, fontWeight: '700' }, action: { color: '#f0d586', fontWeight: '700' },
  error: { color: '#ffbba7', paddingVertical: 12 }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  emptyTitle: { color: '#fff6d9', fontSize: 22, fontWeight: '800' }, note: { color: '#c9d8c2', lineHeight: 22, textAlign: 'center' },
  plain: { color: '#fff6d9', fontSize: 28, lineHeight: 42, fontWeight: '700', marginTop: 14 },
  disclaimer: { color: '#a8bda5', fontSize: 11, textAlign: 'center', marginVertical: 8 },
  seekTouch: { paddingVertical: 14 }, seekTrack: { height: 4, backgroundColor: '#608069', borderRadius: 2 }, seekFill: { height: 4, backgroundColor: '#fff4d2', borderRadius: 2 },
  times: { flexDirection: 'row', justifyContent: 'space-between' }, time: { color: '#ced6be', fontSize: 12 },
  play: { alignSelf: 'center', width: 68, height: 68, borderRadius: 34, backgroundColor: '#fff5d7', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
});
