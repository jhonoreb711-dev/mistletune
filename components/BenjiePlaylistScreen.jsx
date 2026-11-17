import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, FlatList, Modal, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { Image, ImageBackground } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../themes/ThemeProvider';
import { usePlayback } from './PlaybackContext';
import SongArtwork from './SongArtwork';
import { loadBenjiePlaylist, saveBenjiePlaylist, removeBenjiePlaylistSong } from './benjiePlaylistStorage';

const benjie = require('../assets/benjie_animated.gif');
export default function BenjiePlaylistScreen() {
  const { libraryId } = usePlayback();
  return <PlaylistContent key={libraryId || 'loading'} libraryId={libraryId} />;
}
function PlaylistContent({ libraryId }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const { tracks, playQueue, currentTrack } = usePlayback();
  const [ids, setIds] = useState([]);
  const [draft, setDraft] = useState([]);
  const [editing, setEditing] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const mutationInProgress = useRef(false);
  const [deletingId, setDeletingId] = useState(null);
  const [retry, setRetry] = useState(0);
  const [intro, setIntro] = useState(true);
  const [entrance] = useState(() => new Animated.Value(0));
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => setIntro(false), 2600);
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!active) return;
      if (reduce) entrance.setValue(1);
      else Animated.spring(entrance, { toValue: 1, damping: 18, stiffness: 110, useNativeDriver: true }).start();
    }).catch(() => { if (active) entrance.setValue(1); });
    return () => { active = false; clearTimeout(timer); entrance.stopAnimation(); };
  }, [entrance]);
  useEffect(() => {
    if (!libraryId) return;
    let active = true;
    loadBenjiePlaylist(libraryId).then((saved) => { if (active) { setIds(saved); setReady(true); } })
      .catch((cause) => { if (active) setError(cause.message || 'Could not load your playlist.'); });
    return () => { active = false; };
  }, [libraryId, retry]);
  const playlistTracks = useMemo(() => {
    const byId = new Map(tracks.map((track) => [track.id, track]));
    return ids.map((id) => byId.get(id)).filter(Boolean);
  }, [ids, tracks]);
  const selected = useMemo(() => new Set(draft), [draft]);
  const startEditing = () => { setDraft(ids); setEditing(true); setError(''); };
  const toggle = (id) => setDraft((previous) => previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id]);
  const save = async () => {
    if (mutationInProgress.current || !ready) return;
    mutationInProgress.current = true;
    setSaving(true); setError('');
    try { await saveBenjiePlaylist(libraryId, draft); setIds(draft); setEditing(false); }
    catch (cause) { setError(cause.message || 'Could not save your playlist.'); }
    finally { mutationInProgress.current = false; setSaving(false); }
  };
  const deleteSong = async (track) => {
    if (mutationInProgress.current || !ready) return;
    mutationInProgress.current = true;
    setSaving(true); setDeletingId(track.id); setError('');
    try {
      const updated = await removeBenjiePlaylistSong(libraryId, track.id);
      setIds(updated);
    } catch (cause) { setError(cause.message || 'Could not remove this song. Please try again.'); }
    finally { mutationInProgress.current = false; setSaving(false); setDeletingId(null); }
  };
  const play = (track) => { if (playQueue(playlistTracks, track, null, 'benjie-playlist') !== false) router.push('/Player'); };
  const button = { backgroundColor: c.surfaceRaised, borderColor: c.gold };
  return <ImageBackground source={require('../assets/homevideo/benjie_bg.gif')} autoplay contentFit="cover" style={[s.screen, { backgroundColor: c.primary }]}>
    <StatusBar barStyle="light-content" />
    <View style={[s.header, { paddingTop: insets.top + 14, backgroundColor: c.surfaceDeep }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to library" disabled={saving} onPress={() => editing ? setEditing(false) : router.back()} style={[s.iconButton, button]}><Ionicons name="arrow-back" size={23} color={c.gold} /></Pressable>
      <View style={{ flex: 1 }}><Text style={[s.heading, { color: c.cream }]}>Benjie’s Playlist</Text><Text style={[s.subtitle, { color: c.onSurfaceMuted }]}>{editing ? 'Choose songs from your library' : playlistTracks.length + ' local songs - Made by you'}</Text></View>
      <Ionicons name="paw" size={25} color={c.gold} />
    </View>
    <FlatList data={editing ? tracks : playlistTracks} keyExtractor={(track) => track.id} style={{ flex: 1 }}
      contentContainerStyle={[s.list, { paddingBottom: insets.bottom + (currentTrack ? 165 : 95) }]} extraData={selected}
      ListHeaderComponent={<View>
        <View style={[s.hero, { backgroundColor: c.surfaceDeep, borderColor: c.gold }]}>
          <Image source={benjie} autoplay contentFit="contain" style={s.mascot} />
          <View style={{ flex: 1 }}><Text style={[s.heroTitle, { color: c.cream }]}>{editing ? 'Pick your favorites' : 'A little music with Benjie'}</Text><Text style={[s.description, { color: c.onSurfaceMuted }]}>{editing ? selected.size + ' songs selected. Tap a song to add or remove it.' : 'Your own collection, saved on this device and ready to play offline.'}</Text></View>
        </View>
        <View style={s.controls}>
          {editing ? <>
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => { setEditing(false); setError(''); }} style={[s.action, button]}><Text style={[s.actionText, { color: c.cream }]}>Cancel</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={saving || !ready} onPress={save} style={[s.action, { backgroundColor: c.gold }]}>{saving ? <ActivityIndicator color={c.surfaceDeep} /> : <Ionicons name="checkmark" size={19} color={c.surfaceDeep} />}<Text style={[s.actionText, { color: c.surfaceDeep }]}>{saving ? 'Saving...' : 'Save playlist'}</Text></Pressable>
          </> : <>
            <Pressable accessibilityRole="button" disabled={!playlistTracks.length || !ready} onPress={() => play(playlistTracks[0])} style={[s.action, { backgroundColor: c.gold, opacity: playlistTracks.length ? 1 : 0.5 }]}><Ionicons name="play" size={18} color={c.surfaceDeep} /><Text style={[s.actionText, { color: c.surfaceDeep }]}>Play all</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={!ready || saving} onPress={startEditing} style={[s.action, button, { opacity: ready ? 1 : 0.5 }]}><Ionicons name="add" size={20} color={c.gold} /><Text style={[s.actionText, { color: c.cream }]}>Edit songs</Text></Pressable>
          </>}
        </View>
        {error ? <View style={[s.errorBox, { backgroundColor: c.surfaceDeep, borderColor: c.gold }]}><Text accessibilityLiveRegion="polite" style={[s.description, { color: c.cream }]}>{error}</Text>{!ready && <Pressable accessibilityRole="button" onPress={() => { setError(''); setRetry((value) => value + 1); }} style={s.retry}><Text style={[s.actionText, { color: c.gold }]}>Try again</Text></Pressable>}</View> : null}
      </View>}
      ListEmptyComponent={<View style={[s.empty, { backgroundColor: c.surfaceDeep, borderColor: c.gold }]}>
        {!ready && !error ? <ActivityIndicator color={c.gold} /> : <><Ionicons name={editing ? 'musical-notes-outline' : 'paw-outline'} size={38} color={c.gold} /><Text style={[s.heroTitle, { color: c.cream }]}>{editing ? 'No local songs yet' : 'Make Benjie’s first playlist'}</Text><Text style={[s.description, { color: c.onSurfaceMuted, textAlign: 'center' }]}>{editing ? 'Add music in Settings, then choose it here.' : 'Tap Edit songs to choose music from your local library.'}</Text></>}
      </View>}
      renderItem={({ item }) => <View style={[s.song, { backgroundColor: c.surfaceDeep, borderColor: editing && selected.has(item.id) ? c.gold : c.surfaceBorder }]}>
        <Pressable accessibilityRole={editing ? 'checkbox' : 'button'} accessibilityState={editing ? { checked: selected.has(item.id), disabled: saving } : { disabled: saving }} accessibilityLabel={item.title || 'Song'} disabled={saving} onPress={() => editing ? toggle(item.id) : play(item)} style={({ pressed }) => [s.songBody, { opacity: pressed ? 0.8 : 1 }]}>
          <SongArtwork source={item.artwork} style={s.artwork} iconSize={23} />
          <View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={[s.songTitle, { color: c.cream }]}>{item.title}</Text><Text numberOfLines={1} style={[s.subtitle, { color: c.onSurfaceMuted }]}>{item.artist || 'Unknown artist'}</Text></View>
          <Ionicons name={editing ? selected.has(item.id) ? 'checkbox' : 'square-outline' : 'play-circle-outline'} size={27} color={c.gold} />
        </Pressable>
        {!editing && <Pressable accessibilityRole="button" accessibilityLabel={'Delete ' + (item.title || 'song') + ' from Benjie playlist'} accessibilityHint="Removes this song from the playlist. The music file stays in your library." accessibilityState={{ disabled: saving, busy: deletingId === item.id }} disabled={saving} onPress={() => deleteSong(item)} style={({ pressed }) => [s.deleteButton, { backgroundColor: c.surfaceRaised, opacity: saving && deletingId !== item.id ? 0.5 : pressed ? 0.75 : 1 }]}>
          {deletingId === item.id ? <ActivityIndicator color={c.gold} /> : <Ionicons name="trash-outline" size={21} color={c.gold} />}
        </Pressable>}
      </View>} />
    <Modal visible={intro} transparent={false} animationType="fade" onRequestClose={() => setIntro(false)}>
      <View style={[s.intro, { backgroundColor: c.surfaceDeep, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Animated.View style={[s.introContent, { opacity: entrance, transform: [{ scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }] }]}>
          <View style={[s.introFrame, { borderColor: c.gold, backgroundColor: c.surfaceRaised }]}><Image source={benjie} autoplay contentFit="contain" style={s.introImage} /></View>
          <Text style={[s.introTitle, { color: c.cream }]}>Benjie’s Playlist</Text><Text style={[s.description, { color: c.onSurfaceMuted }]}>Good company. Great music.</Text>
        </Animated.View>
        <Pressable accessibilityRole="button" onPress={() => setIntro(false)} style={s.skip}><Text style={[s.actionText, { color: c.gold }]}>Open playlist</Text></Pressable>
      </View>
    </Modal>
  </ImageBackground>;
}
const s = StyleSheet.create({
  screen: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 18 }, iconButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, heading: { fontFamily: 'NunitoExtraBold', fontSize: 23 }, subtitle: { fontFamily: 'NunitoRegular', fontSize: 12, marginTop: 3 },
  list: { padding: 18, gap: 11 }, hero: { flexDirection: 'row', alignItems: 'center', padding: 15, gap: 12, borderRadius: 22, borderWidth: 1 }, mascot: { width: 78, height: 92 }, heroTitle: { fontFamily: 'NunitoExtraBold', fontSize: 18 }, description: { fontFamily: 'NunitoRegular', fontSize: 13, lineHeight: 19, marginTop: 6 }, controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 17 }, action: { flex: 1, minWidth: 120, minHeight: 48, borderWidth: 1, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 10 }, actionText: { fontFamily: 'NunitoExtraBold', fontSize: 13 },
  songBody: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54 }, deleteButton: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  song: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 17, padding: 11, minHeight: 78 }, artwork: { width: 52, height: 52, borderRadius: 12 }, songTitle: { fontFamily: 'NunitoBold', fontSize: 14 }, empty: { padding: 26, gap: 9, alignItems: 'center', borderRadius: 20, borderWidth: 1 }, errorBox: { padding: 15, borderRadius: 15, borderWidth: 1, marginBottom: 14 }, retry: { paddingVertical: 12 },
  intro: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 25 }, introContent: { width: '100%', alignItems: 'center' }, introFrame: { width: '80%', maxWidth: 300, aspectRatio: 1, borderRadius: 40, borderWidth: 2, padding: 18, marginBottom: 25 }, introImage: { flex: 1, width: '100%' }, introTitle: { fontFamily: 'NunitoExtraBold', fontSize: 29, textAlign: 'center' }, skip: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 18, marginTop: 32 },
});
