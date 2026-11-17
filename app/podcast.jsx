import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  TextInput,
  Platform,
  Pressable,
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import ThemeImageBackground from '../components/ThemeImageBackground';
import { getPodcastBackground } from '../components/podcastBackgrounds';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PodcastActionDialog from '../components/PodcastActionDialog';
import PodcastCard, { podcastTitle } from '../components/PodcastCard';
import { useTheme, useThemeStyles } from '../themes/ThemeProvider';
import { getPodcastVideos, savePodcastVideos, recordWatchedPodcast, removePodcastEpisode } from '../components/podcastVideoStorage';
import { usePlayback } from '../components/PlaybackContext';
import { groupPodcastVideos, getPodcastEpisodePreview } from '../components/podcastCollections';

const DEFAULT_COLORS = {
  green: '#164d38',
  red: '#a62224',
  ink: '#29251e',
  muted: '#837866',
  cream: '#fff8e9',
  gold: '#f2bb4f',
};


export default function PodcastScreen() {
  const { theme } = useTheme();
  const { styles, colors: COLORS } = useThemeStyles(createStyles, DEFAULT_COLORS);
  const { videoId, podcastId } = useLocalSearchParams();
  const openedVideoRef = useRef(null);
  const insets = useSafeAreaInsets();
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [renameVideo, setRenameVideo] = useState(null);
  const [renameText, setRenameText] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
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
  const collections = groupPodcastVideos(videos);
  const selectedCollection = collections.find((collection) => collection.id === podcastId);
  const listItems = selectedCollection ? selectedCollection.episodes : collections;

  const handlePlayVideo = (video) => {
    if (playing && stopPlayback) {
      stopPlayback();
    }
    setSelectedVideo(video);
    recordWatchedPodcast(video).catch((error) => console.warn('Could not save watch history:', error));
  };

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
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={styles.headerButton}
          >
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
          </Pressable>
        </View>

        <FlatList
          key={selectedCollection ? 'episodes:' + selectedCollection.id : 'podcast-sections'}
          data={listItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => selectedCollection
            ? <PodcastCard video={item} onPress={() => handlePlayVideo(item)} onRename={() => { setRenameVideo(item); setRenameText(podcastTitle(item)); }} onDelete={() => deleteEpisode(item)} />
            : renderCollection(item)}
          contentContainerStyle={styles.content}
          ItemSeparatorComponent={() => <View style={{ height: selectedCollection ? 16 : 24 }} />}
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          windowSize={5}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="videocam-outline" size={38} color={COLORS.gold} />
              </View>
              <Text style={styles.emptyTitle}>No podcasts yet</Text>
              <Text style={styles.emptyMessage}>
                Add podcast videos in Settings to play them here.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add a podcast"
                onPress={() => router.push('/podcast-create')}
                style={({ pressed }) => [styles.emptyAddButton, pressed && { opacity: 0.85 }]}
              >
                <Ionicons name="add-circle-outline" size={18} color={COLORS.cream} />
                <Text style={styles.emptyAddText}>Add podcast</Text>
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
              <Ionicons name={`${tab.icon}-outline`} size={23} color={COLORS.gold} />
              <Text style={styles.tabLabel}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

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
  );
}

function PodcastVideoPlayer({ video, onClose }) {
  const { styles } = useThemeStyles(createStyles, DEFAULT_COLORS);
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
      <Text numberOfLines={1} style={styles.playingName}>{video.episodeNumber ? `Episode ${video.episodeNumber} · ` : ''}{podcastTitle(video)}</Text>
    </View>
  );
}

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
  videoMain: { minWidth: 0 },
  videoPressed: { opacity: 0.9 },
  videoPreview: { width: '100%', aspectRatio: 16 / 9, overflow: 'hidden', backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  videoOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
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
  playerScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  fullVideo: { width: '100%', flex: 1 },
  closeButton: { position: 'absolute', top: 52, right: 20, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 10 },
  playingName: { position: 'absolute', top: 60, left: 20, right: 76, color: '#fff', fontFamily: 'NunitoBold', fontSize: 16, textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 4 },
});
