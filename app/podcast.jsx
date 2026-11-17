import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
<<<<<<< HEAD
=======
  Alert,
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
  TextInput,
  Platform,
  Pressable,
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
<<<<<<< HEAD
import ThemeImageBackground from '../components/ThemeImageBackground';
import { getPodcastBackground } from '../components/podcastBackgrounds';
=======
import { ImageBackground } from 'expo-image';
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

<<<<<<< HEAD
import PodcastActionDialog from '../components/PodcastActionDialog';
import PodcastCard, { podcastTitle } from '../components/PodcastCard';
import { useTheme, useThemeStyles } from '../themes/ThemeProvider';
import { getPodcastVideos, savePodcastVideos, recordWatchedPodcast, removePodcastEpisode } from '../components/podcastVideoStorage';
import { usePlayback } from '../components/PlaybackContext';
import { groupPodcastVideos, getPodcastEpisodePreview } from '../components/podcastCollections';

const DEFAULT_COLORS = {
=======
import PodcastCard, { podcastTitle } from '../components/PodcastCard';
import christmasBackground from '../assets/christmas_bg4.png';
import { getPodcastVideos, savePodcastVideos, recordWatchedPodcast } from '../components/podcastVideoStorage';
import { usePlayback } from '../components/PlaybackContext';

const COLORS = {
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
  green: '#164d38',
  red: '#a62224',
  ink: '#29251e',
  muted: '#837866',
  cream: '#fff8e9',
  gold: '#f2bb4f',
};

<<<<<<< HEAD

export default function PodcastScreen() {
  const { theme } = useTheme();
  const { styles, colors: COLORS } = useThemeStyles(createStyles, DEFAULT_COLORS);
  const { videoId, podcastId } = useLocalSearchParams();
=======
export default function PodcastScreen() {
  const { videoId } = useLocalSearchParams();
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
  const openedVideoRef = useRef(null);
  const insets = useSafeAreaInsets();
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [renameVideo, setRenameVideo] = useState(null);
  const [renameText, setRenameText] = useState('');
<<<<<<< HEAD
  const [deleteTarget, setDeleteTarget] = useState(null);
=======
  const [savingName, setSavingName] = useState(false);
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
  const { playing, stopPlayback } = usePlayback();
  const stopPlaybackRef = useRef(stopPlayback);
  useEffect(() => { stopPlaybackRef.current = stopPlayback; }, [stopPlayback]);

  const loadVideos = useCallback(() => {
    let active = true;
    getPodcastVideos().then((storedVideos) => {
      if (active) {
        setVideos(storedVideos);
        const requested = storedVideos.find((video) => video.id === videoId);
        if (requested && openedVideoRef.current !== requested.id) {
          openedVideoRef.current = requested.id;
          stopPlaybackRef.current?.();
          setSelectedVideo(requested);
          recordWatchedPodcast(requested).catch((error) => console.warn('Could not save watch history:', error));
        }
      }
    });
    return () => { active = false; setSelectedVideo(null); };
  }, [videoId]);

  useFocusEffect(loadVideos);
<<<<<<< HEAD
  const collections = groupPodcastVideos(videos);
  const selectedCollection = collections.find((collection) => collection.id === podcastId);
  const listItems = selectedCollection ? selectedCollection.episodes : collections;
=======
>>>>>>> 2376395559270ab40f72453a5475d22bec935705

  const handlePlayVideo = (video) => {
    if (playing && stopPlayback) {
      stopPlayback();
    }
    setSelectedVideo(video);
    recordWatchedPodcast(video).catch((error) => console.warn('Could not save watch history:', error));
  };

<<<<<<< HEAD
  const deleteEpisode = (video) => setDeleteTarget(video);
  const confirmDelete = async () => {
    const updated = await removePodcastEpisode(deleteTarget.id);
    setVideos(updated);
    setSelectedVideo((current) => current?.id === deleteTarget.id ? null : current);
  };

  const renderCollection = (collection) => <View style={styles.showSection}>
    <View style={styles.showHeading}>
      <Text numberOfLines={2} style={styles.showTitle}>{collection.title}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`See all episodes of ${collection.title}`} onPress={() => router.push({ pathname: '/podcast', params: { podcastId: collection.id } })} style={styles.seeAll}>
        <Text style={styles.seeAllText}>See all ({collection.episodes.length})</Text><Ionicons name="chevron-forward" size={16} color={COLORS.gold} />
      </Pressable>
    </View>
    <FlatList horizontal data={getPodcastEpisodePreview(collection)} keyExtractor={(episode) => episode.id}
      showsHorizontalScrollIndicator={false} contentContainerStyle={styles.episodePreview}
      ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
      renderItem={({ item }) => <PodcastCard video={item} horizontal albumSized onPress={() => handlePlayVideo(item)} onDelete={() => deleteEpisode(item)} />}
    />
  </View>;

  const saveName = async () => {
    if (!renameVideo || !renameText.trim()) return false;
    const stored = await getPodcastVideos();
    const updated = stored.map((video) => video.id === renameVideo.id
      ? { ...video, title: renameText.trim(), name: renameText.trim() } : video);
    await savePodcastVideos(updated);
    setVideos(updated);
  };

  return (
    <ThemeImageBackground source={getPodcastBackground(theme)} contentFit="cover" autoplay style={styles.background}>
      <StatusBar barStyle="light-content" />
=======
  const saveName = async () => {
    if (!renameVideo || !renameText.trim() || savingName) return;
    setSavingName(true);
    try {
      const stored = await getPodcastVideos();
      const updated = stored.map((video) => video.id === renameVideo.id
        ? { ...video, title: renameText.trim(), name: renameText.trim() } : video);
      await savePodcastVideos(updated);
      setVideos(updated);
      setRenameVideo(null);
    } catch {
      Alert.alert('Rename podcast', 'Could not save the name. Please try again.');
    } finally {
      setSavingName(false);
    }
  };

  return (
    <ImageBackground source={christmasBackground} contentFit="cover" style={styles.background}>
      <StatusBar barStyle="dark-content" />
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={styles.headerButton}
          >
<<<<<<< HEAD
            <Ionicons name="arrow-back" size={21} color={COLORS.gold} />
          </Pressable>
          <View style={styles.headerTitles}>
            <Text numberOfLines={2} style={styles.headerTitle}>{selectedCollection?.title || 'Podcast'}</Text>
            <Text numberOfLines={3} style={styles.headerSubtitle}>{selectedCollection?.description || (selectedCollection ? `${selectedCollection.episodes.length} episodes` : 'Your local podcast collection')}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a podcast"
            onPress={() => router.push('/podcast-create')}
            style={styles.headerButton}
          >
            <Ionicons name="add" size={23} color={COLORS.gold} />
=======
            <Ionicons name="arrow-back" size={21} color={COLORS.green} />
          </Pressable>
          <View style={styles.headerTitles}>
            <Text style={styles.title}>Podcast</Text>
            <Text style={styles.subtitle}>Your local podcast collection</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Manage videos in Settings"
            onPress={() => router.push('/Settings')}
            style={styles.headerButton}
          >
            <Ionicons name="settings-outline" size={20} color={COLORS.green} />
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
          </Pressable>
        </View>

        <FlatList
<<<<<<< HEAD
          key={selectedCollection ? 'episodes:' + selectedCollection.id : 'podcast-sections'}
          data={listItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => selectedCollection
            ? <PodcastCard video={item} onPress={() => handlePlayVideo(item)} onRename={() => { setRenameVideo(item); setRenameText(podcastTitle(item)); }} onDelete={() => deleteEpisode(item)} />
            : renderCollection(item)}
          contentContainerStyle={styles.content}
          ItemSeparatorComponent={() => <View style={{ height: selectedCollection ? 16 : 24 }} />}
=======
          data={videos}
          keyExtractor={(video) => video.id}
          renderItem={({ item }) => <PodcastCard video={item} onPress={() => handlePlayVideo(item)} onRename={() => { setRenameVideo(item); setRenameText(podcastTitle(item)); }} />}
          contentContainerStyle={styles.content}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          windowSize={5}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
<<<<<<< HEAD
                <Ionicons name="videocam-outline" size={38} color={COLORS.gold} />
=======
                <Ionicons name="videocam-outline" size={38} color={COLORS.green} />
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
              </View>
              <Text style={styles.emptyTitle}>No podcasts yet</Text>
              <Text style={styles.emptyMessage}>
                Add podcast videos in Settings to play them here.
              </Text>
              <Pressable
                accessibilityRole="button"
<<<<<<< HEAD
                accessibilityLabel="Add a podcast"
                onPress={() => router.push('/podcast-create')}
                style={({ pressed }) => [styles.emptyAddButton, pressed && { opacity: 0.85 }]}
              >
                <Ionicons name="add-circle-outline" size={18} color={COLORS.cream} />
                <Text style={styles.emptyAddText}>Add podcast</Text>
=======
                accessibilityLabel="Open Settings"
                onPress={() => router.push('/Settings')}
                style={({ pressed }) => [styles.emptyAddButton, pressed && { opacity: 0.85 }]}
              >
                <Ionicons name="settings-outline" size={18} color={COLORS.cream} />
                <Text style={styles.emptyAddText}>Open Settings</Text>
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
              </Pressable>
            </View>
          }
        />

        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          {[
            { label: 'Home', icon: 'home' },
            { label: 'Search', icon: 'search' },
            { label: 'Your Library', icon: 'library' },
            { label: 'Settings', icon: 'settings' },
          ].map((tab) => (
            <Pressable
              key={tab.label}
              accessibilityRole="button"
              onPress={() => {
                if (tab.label === 'Home') router.replace('/Music');
                if (tab.label === 'Search') router.push('/Search');
                if (tab.label === 'Your Library') router.push('/Library');
                if (tab.label === 'Settings') router.push('/Settings');
              }}
              style={styles.tab}
            >
<<<<<<< HEAD
              <Ionicons name={`${tab.icon}-outline`} size={23} color={COLORS.gold} />
=======
              <Ionicons name={`${tab.icon}-outline`} size={23} color={COLORS.muted} />
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
              <Text style={styles.tabLabel}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

<<<<<<< HEAD
      <PodcastActionDialog visible={Boolean(deleteTarget)} video={deleteTarget} title="Delete episode?"
        message="Remove this video from your podcast collection? Your other episodes and shows will stay."
        destructive onConfirm={confirmDelete} onClose={() => setDeleteTarget(null)} />
      <PodcastActionDialog visible={Boolean(renameVideo)} video={renameVideo} title="Rename podcast"
        message="Give this video a name that is easy to find." icon="pencil-outline" confirmLabel="Save name"
        confirmDisabled={!renameText.trim()} onConfirm={saveName} onClose={() => setRenameVideo(null)}>
        <TextInput accessibilityLabel="Podcast name" value={renameText} onChangeText={setRenameText} maxLength={150}
          autoFocus style={[styles.renameInput, { marginTop: 16, color: theme.colors.cream, backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.surfaceBorder }]}
          placeholder="Podcast name" placeholderTextColor={theme.colors.onSurfaceMuted} returnKeyType="done" />
      </PodcastActionDialog>
      <Modal visible={Boolean(selectedVideo)} animationType="fade" onRequestClose={() => setSelectedVideo(null)}>
        {selectedVideo ? <PodcastVideoPlayer video={selectedVideo} onClose={() => setSelectedVideo(null)} /> : null}
      </Modal>
    </ThemeImageBackground>
=======
      <Modal visible={Boolean(renameVideo)} transparent animationType="fade" onRequestClose={() => { if (!savingName) setRenameVideo(null); }}>
        <View style={styles.renameOverlay}>
          <View style={styles.renameSheet}>
            <Text style={styles.title}>Rename podcast</Text>
            <TextInput accessibilityLabel="Podcast name" value={renameText} onChangeText={setRenameText} maxLength={150} autoFocus style={styles.renameInput} returnKeyType="done" onSubmitEditing={saveName} />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 20 }}>
              <Pressable disabled={savingName} onPress={() => setRenameVideo(null)} style={{ padding: 10 }}><Text style={styles.subtitle}>Cancel</Text></Pressable>
              <Pressable disabled={savingName || !renameText.trim()} onPress={saveName} style={{ padding: 10 }}><Text style={{ color: COLORS.green, fontFamily: 'NunitoBold' }}>{savingName ? 'Saving…' : 'Save'}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={Boolean(selectedVideo)} animationType="fade" onRequestClose={() => setSelectedVideo(null)}>
        {selectedVideo ? <PodcastVideoPlayer video={selectedVideo} onClose={() => setSelectedVideo(null)} /> : null}
      </Modal>
    </ImageBackground>
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
  );
}

function PodcastVideoPlayer({ video, onClose }) {
<<<<<<< HEAD
  const { styles } = useThemeStyles(createStyles, DEFAULT_COLORS);
=======
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
  const [playbackError, setPlaybackError] = useState(null);
  const player = useVideoPlayer(video.uri, (videoPlayer) => {
    videoPlayer.play();
  });

  useEffect(() => {
    const subscription = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'error') {
        console.warn('Podcast video playback failed:', error);
        setPlaybackError('This video could not be played. Try an MP4 video encoded with H.264 video and AAC audio.');
      }
    });
    return () => subscription.remove();
  }, [player]);

  return (
    <View style={styles.playerScreen}>
      <StatusBar hidden />
      <VideoView
        player={player}
        style={styles.fullVideo}
        contentFit="contain"
        nativeControls
        surfaceType={Platform.OS === 'android' ? 'textureView' : undefined}
      />
      <Pressable accessibilityRole="button" accessibilityLabel="Close video" onPress={onClose} style={styles.closeButton}>
        <Ionicons name="close" size={26} color="#fff" />
      </Pressable>
      {playbackError ? <Text style={{ color: '#fff', padding: 24 }}>{playbackError}</Text> : null}
<<<<<<< HEAD
      <Text numberOfLines={1} style={styles.playingName}>{video.episodeNumber ? `Episode ${video.episodeNumber} · ` : ''}{podcastTitle(video)}</Text>
=======
      <Text numberOfLines={1} style={styles.playingName}>{video.name}</Text>
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
    </View>
  );
}

<<<<<<< HEAD
const createStyles = (COLORS) => StyleSheet.create({
  showSection: { backgroundColor: COLORS.surfaceDeep, borderWidth: 1, borderColor: COLORS.surfaceBorder, borderRadius: 18, overflow: 'hidden', paddingBottom: 14 },
  showHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, gap: 8 },
  showTitle: { flex: 1, color: COLORS.gold, fontFamily: 'NunitoExtraBold', fontSize: 17 },
  episodePreview: { paddingHorizontal: 12, alignItems: 'flex-start' },
  collectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 14, backgroundColor: COLORS.surfaceDeep },
  collectionLabel: { color: COLORS.gold, fontFamily: 'NunitoExtraBold', fontSize: 18 },
  seeAll: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 3 },
  seeAllText: { color: COLORS.gold, fontFamily: 'NunitoBold', fontSize: 13 },
  horizontalContent: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 24, alignItems: 'flex-start' },
  renameOverlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.65)' },
  renameSheet: { borderRadius: 18, backgroundColor: COLORS.surfaceDeep, padding: 20, gap: 16 },
  renameInput: { borderWidth: 1, borderColor: COLORS.gold, borderRadius: 10, padding: 12, color: COLORS.cream, fontSize: 16 },
  background: { flex: 1, width: '100%', backgroundColor: COLORS.surfaceDeep },
  screen: { flex: 1, backgroundColor: 'transparent' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: COLORS.surfaceDeep },
  headerButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface },
  headerTitles: { flex: 1 },
  title: { color: COLORS.gold, fontFamily: 'NunitoExtraBold', fontSize: 22 },
  headerTitle: { color: COLORS.gold, fontFamily: 'NunitoExtraBold', fontSize: 22 },
  headerSubtitle: { color: COLORS.onSurfaceMuted, fontFamily: 'NunitoSemiBold', fontSize: 12, marginTop: 1 },
  subtitle: { color: COLORS.onSurfaceMuted, fontFamily: 'NunitoSemiBold', fontSize: 12, marginTop: 1 },
  content: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 6, paddingBottom: 100 },
  videoList: { gap: 16 },
  videoCard: { overflow: 'hidden', borderRadius: 16, backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.surfaceBorder, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
=======
const styles = StyleSheet.create({
  renameOverlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.65)' },
  renameSheet: { borderRadius: 18, backgroundColor: COLORS.cream, padding: 20, gap: 16 },
  renameInput: { borderWidth: 1, borderColor: COLORS.green, borderRadius: 10, padding: 12, color: COLORS.ink, fontSize: 16 },
  background: { flex: 1, width: '100%' },
  screen: { flex: 1, backgroundColor: 'transparent' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingBottom: 16 },
  headerButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,248,233,0.88)' },
  headerTitles: { flex: 1 },
  title: { color: COLORS.green, fontFamily: 'NunitoExtraBold', fontSize: 22 },
  subtitle: { color: COLORS.muted, fontFamily: 'NunitoSemiBold', fontSize: 12, marginTop: 1 },
  content: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 6, paddingBottom: 24 },
  videoList: { gap: 16 },
  videoCard: { overflow: 'hidden', borderRadius: 16, backgroundColor: 'rgba(255,248,233,0.95)', borderWidth: 1.5, borderColor: 'rgba(22,77,56,0.22)', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
  videoMain: { minWidth: 0 },
  videoPressed: { opacity: 0.9 },
  videoPreview: { width: '100%', aspectRatio: 16 / 9, overflow: 'hidden', backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  videoOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
<<<<<<< HEAD
  videoPlayBadge: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceRaised, borderWidth: 2, borderColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 4, elevation: 4 },
  durationBadge: { position: 'absolute', right: 8, bottom: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.82)' },
  durationText: { color: '#ffffff', fontFamily: 'NunitoBold', fontSize: 11 },
  videoTag: { position: 'absolute', left: 8, bottom: 8, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4, backgroundColor: COLORS.red },
  videoTagText: { color: '#ffffff', fontFamily: 'NunitoExtraBold', fontSize: 9, letterSpacing: 0.5 },
  videoDetailsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 },
  videoDetails: { flex: 1, minHeight: 44, justifyContent: 'center', paddingRight: 8 },
  videoName: { color: COLORS.cream, fontFamily: 'NunitoBold', fontSize: 14, lineHeight: 19 },
  videoType: { color: COLORS.onSurfaceMuted, fontFamily: 'NunitoRegular', fontSize: 12, marginTop: 2 },
  playActionPill: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, minHeight: 340, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, borderRadius: 24, backgroundColor: COLORS.surface },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceRaised },
  emptyTitle: { color: COLORS.cream, fontFamily: 'NunitoExtraBold', fontSize: 19, textAlign: 'center', marginTop: 18 },
  emptyMessage: { color: COLORS.onSurfaceMuted, fontFamily: 'NunitoRegular', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8 },
  emptyAddButton: { marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 22, backgroundColor: COLORS.green, elevation: 2 },
  emptyAddText: { color: COLORS.cream, fontFamily: 'NunitoExtraBold', fontSize: 13 },
  bottomBar: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingTop: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(75,59,37,0.22)', backgroundColor: COLORS.surfaceDeep },
  tab: { flex: 1, minWidth: 0, alignItems: 'center', gap: 2 },
  tabLabel: { color: COLORS.gold, fontFamily: 'NunitoSemiBold', fontSize: 11 },
=======
  videoPlayBadge: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(22,77,56,0.85)', borderWidth: 2, borderColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 4, elevation: 4 },
  durationBadge: { position: 'absolute', right: 8, bottom: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.82)' },
  durationText: { color: '#ffffff', fontFamily: 'NunitoBold', fontSize: 11 },
  videoTag: { position: 'absolute', left: 8, bottom: 8, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(166,34,36,0.85)' },
  videoTagText: { color: '#ffffff', fontFamily: 'NunitoExtraBold', fontSize: 9, letterSpacing: 0.5 },
  videoDetailsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 },
  videoDetails: { flex: 1, minHeight: 44, justifyContent: 'center', paddingRight: 8 },
  videoName: { color: COLORS.ink, fontFamily: 'NunitoBold', fontSize: 14, lineHeight: 19 },
  videoType: { color: COLORS.muted, fontFamily: 'NunitoRegular', fontSize: 12, marginTop: 2 },
  playActionPill: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, minHeight: 340, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, borderRadius: 24, backgroundColor: 'rgba(255,248,233,0.88)' },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(22,77,56,0.1)' },
  emptyTitle: { color: COLORS.ink, fontFamily: 'NunitoExtraBold', fontSize: 19, textAlign: 'center', marginTop: 18 },
  emptyMessage: { color: COLORS.muted, fontFamily: 'NunitoRegular', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8 },
  emptyAddButton: { marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 22, backgroundColor: COLORS.green, elevation: 2 },
  emptyAddText: { color: COLORS.cream, fontFamily: 'NunitoExtraBold', fontSize: 13 },
  bottomBar: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingTop: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(75,59,37,0.22)', backgroundColor: COLORS.cream },
  tab: { flex: 1, minWidth: 0, alignItems: 'center', gap: 2 },
  tabLabel: { color: COLORS.muted, fontFamily: 'NunitoSemiBold', fontSize: 11 },
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
  playerScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  fullVideo: { width: '100%', flex: 1 },
  closeButton: { position: 'absolute', top: 52, right: 20, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 10 },
  playingName: { position: 'absolute', top: 60, left: 20, right: 76, color: '#fff', fontFamily: 'NunitoBold', fontSize: 16, textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 4 },
});
