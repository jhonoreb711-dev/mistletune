import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import ThemeImageBackground from '../components/ThemeImageBackground';
import { useTheme, useThemeStyles } from '../themes/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPodcastVideos, savePodcastVideos } from '../components/podcastVideoStorage';
import { pickAndSavePodcastVideos, deleteVideoFile } from '../components/videoFileService';
import { buildPodcastEpisodes } from '../components/podcastCollections';

export default function CreatePodcastScreen() {
  const { theme } = useTheme();
  const { styles, colors: COLORS } = useThemeStyles(createStyles, BASE_COLORS);
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videos, setVideos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  const draft = useRef([]);
  const committed = useRef(false);
  const operation = useRef(null);
  const busyRef = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      void (async () => {
        await operation.current?.catch(() => {});
        if (!committed.current) for (const video of draft.current) await deleteVideoFile(video.uri);
      })();
    };
  }, []);
  const pickVideo = () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    operation.current = (async () => {
      try {
        // One selection at a time guarantees the episode order, even on file
        // providers that return multi-select results in filename order.
        const added = await pickAndSavePodcastVideos(false);
        draft.current = [...draft.current, ...added];
        if (mounted.current) setVideos([...draft.current]);
      } catch (err) { if (mounted.current) setError(err.message || 'Could not import this video.'); }
      finally { busyRef.current = false; if (mounted.current) setBusy(false); }
    })();
  };
  const remove = async (video) => {
    if (busyRef.current) return;
    draft.current = draft.current.filter((item) => item.id !== video.id);
    setVideos([...draft.current]);
    await deleteVideoFile(video.uri);
  };
  const save = () => {
    if (busyRef.current) return;
    let episodes;
    try { episodes = buildPodcastEpisodes(draft.current, { id: `podcast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title, description }); }
    catch (err) { setError(err.message); return; }
    busyRef.current = true; setBusy(true); setError('');
    operation.current = (async () => {
      try {
        const existing = await getPodcastVideos();
        if (!mounted.current) return;
        await savePodcastVideos([...existing, ...episodes]);
        committed.current = true;
        if (mounted.current) router.replace('/podcast');
      } catch (err) { if (mounted.current) setError(err.message || 'Could not save the podcast.'); }
      finally { busyRef.current = false; if (mounted.current) setBusy(false); }
    })();
  };
  return <ThemeImageBackground source={theme.assets.collection} contentFit="cover" style={styles.background}>
    <KeyboardAvoidingView style={styles.background} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel new podcast" disabled={busy} onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={23} color={COLORS.gold} /></Pressable>
        <View><Text style={styles.heading}>Add podcast</Text><Text style={styles.subtitle}>Your stories, in the right order</Text></View>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}>
        <View style={styles.panel}>
          <Text style={styles.label}>Podcast title</Text>
          <TextInput accessibilityLabel="Podcast title" value={title} onChangeText={setTitle} editable={!busy} maxLength={150} placeholder="Name your podcast" placeholderTextColor={COLORS.onSurfaceMuted} style={styles.input} />
          <Text style={styles.label}>Description</Text>
          <TextInput accessibilityLabel="Podcast description" value={description} onChangeText={setDescription} editable={!busy} maxLength={2000} multiline textAlignVertical="top" placeholder="What is this podcast about?" placeholderTextColor={COLORS.onSurfaceMuted} style={[styles.input, styles.description]} />
        </View>
        <View style={styles.panel}>
          <View style={styles.row}><Ionicons name="film-outline" size={22} color={COLORS.gold} /><Text style={styles.sectionTitle}>Videos · {videos.length}</Text></View>
          <Text style={styles.subtitle}>Choose videos one at a time. Your first selection becomes Episode 1, then Episode 2, and so on.</Text>
          {videos.map((video, index) => <View key={video.id} style={styles.episode}>
            <View style={styles.number}><Text style={styles.numberText}>{index + 1}</Text></View>
            <View style={styles.flex}><Text style={styles.episodeTitle}>Episode {index + 1}</Text><Text numberOfLines={2} style={styles.subtitle}>{video.name}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove Episode ${index + 1}`} disabled={busy} onPress={() => remove(video)} style={styles.remove}><Ionicons name="close-circle-outline" size={24} color="#a62224" /></Pressable>
          </View>)}
          <Pressable accessibilityRole="button" disabled={busy} onPress={pickVideo} style={[styles.picker, busy && styles.disabled]}><Ionicons name="add-circle-outline" size={22} color={COLORS.gold} /><Text style={styles.pickerText}>{busy ? 'Please wait…' : `Choose video for Episode ${videos.length + 1}`}</Text></Pressable>
        </View>
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <Pressable accessibilityRole="button" disabled={busy || !title.trim() || !videos.length} onPress={save} style={[styles.save, (busy || !title.trim() || !videos.length) && styles.disabled]}>
          {busy ? <ActivityIndicator color={COLORS.cream} /> : <Ionicons name="checkmark-circle-outline" size={23} color={COLORS.cream} />}<Text style={styles.saveText}>Add podcast</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  </ThemeImageBackground>;
}
const BASE_COLORS = { green: '#164d38', cream: '#fff8e9', gold: '#f2bb4f' };
const createStyles = (colors) => StyleSheet.create({
  background: { flex: 1, backgroundColor: colors.surfaceDeep }, header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20 },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  heading: { fontFamily: 'NunitoExtraBold', fontSize: 25, color: colors.cream }, subtitle: { fontFamily: 'NunitoRegular', fontSize: 13, color: colors.onSurfaceMuted, lineHeight: 20 },
  content: { padding: 18, gap: 18 }, panel: { padding: 18, borderRadius: 22, backgroundColor: colors.surfaceDeep, borderWidth: 1, borderColor: colors.surfaceBorder, gap: 12 },
  label: { fontFamily: 'NunitoBold', fontSize: 15, color: colors.cream }, input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: 12, padding: 13, color: colors.cream, fontSize: 16 }, description: { minHeight: 116 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, sectionTitle: { color: colors.cream, fontFamily: 'NunitoExtraBold', fontSize: 18 },
  episode: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder, paddingVertical: 10 },
  number: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' }, numberText: { color: colors.gold, fontFamily: 'NunitoBold' },
  flex: { flex: 1 }, episodeTitle: { color: colors.cream, fontFamily: 'NunitoBold', fontSize: 14 }, remove: { padding: 10 },
  picker: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, borderWidth: 1, borderColor: colors.surfaceBorder, padding: 10 }, pickerText: { color: colors.cream, fontFamily: 'NunitoBold', fontSize: 13, flexShrink: 1 },
  save: { minHeight: 54, borderRadius: 18, backgroundColor: colors.surfaceRaised, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 }, saveText: { color: colors.cream, fontFamily: 'NunitoExtraBold', fontSize: 16 },
  disabled: { opacity: 0.5 }, error: { color: '#a62224', backgroundColor: colors.surface, padding: 14, borderRadius: 12 },
});
