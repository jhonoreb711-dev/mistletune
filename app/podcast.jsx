import { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ImageBackground } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import christmasBackground from '../assets/christmas_bg4.png';
import { getPodcastVideos } from '../components/podcastVideoStorage';
import { usePlayback } from '../components/PlaybackContext';

const COLORS = {
  green: '#164d38',
  red: '#a62224',
  ink: '#29251e',
  muted: '#837866',
  cream: '#fff8e9',
  gold: '#f2bb4f',
};

function formatDuration(timeInSeconds) {
  if (!Number.isFinite(timeInSeconds) || timeInSeconds <= 0) return '';
  const total = Math.floor(timeInSeconds);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function PodcastScreen() {
  const { videoId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const { playing, stopPlayback } = usePlayback();

  const loadVideos = useCallback(() => {
    let active = true;
    getPodcastVideos().then((storedVideos) => {
      if (active) {
        setVideos(storedVideos);
        const requested = storedVideos.find((video) => video.id === videoId);
        if (requested) {
          stopPlayback?.();
          setSelectedVideo(requested);
        }
      }
    });
    return () => { active = false; };
  }, [videoId, stopPlayback]);

  useFocusEffect(loadVideos);

  const handlePlayVideo = (video) => {
    if (playing && stopPlayback) {
      stopPlayback();
    }
    setSelectedVideo(video);
  };

  return (
    <ImageBackground source={christmasBackground} contentFit="cover" style={styles.background}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={styles.headerButton}
          >
            <Ionicons name="arrow-back" size={21} color={COLORS.green} />
          </Pressable>
          <View style={styles.headerTitles}>
            <Text style={styles.title}>Podcast videos</Text>
            <Text style={styles.subtitle}>Your video playlist</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Manage videos in Settings"
            onPress={() => router.push('/Settings')}
            style={styles.headerButton}
          >
            <Ionicons name="settings-outline" size={20} color={COLORS.green} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {videos.length ? (
            <View style={styles.videoList}>
              {videos.map((video) => (
                <PodcastVideoCard
                  key={video.id}
                  video={video}
                  onPress={() => handlePlayVideo(video)}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="videocam-outline" size={38} color={COLORS.green} />
              </View>
              <Text style={styles.emptyTitle}>No podcast videos yet</Text>
              <Text style={styles.emptyMessage}>
                Add podcast videos in Settings to play them here.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open Settings"
                onPress={() => router.push('/Settings')}
                style={({ pressed }) => [styles.emptyAddButton, pressed && { opacity: 0.85 }]}
              >
                <Ionicons name="settings-outline" size={18} color={COLORS.cream} />
                <Text style={styles.emptyAddText}>Open Settings</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>

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
              <Ionicons name={`${tab.icon}-outline`} size={23} color={COLORS.muted} />
              <Text style={styles.tabLabel}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Modal visible={Boolean(selectedVideo)} animationType="fade" onRequestClose={() => setSelectedVideo(null)}>
        {selectedVideo ? <PodcastVideoPlayer video={selectedVideo} onClose={() => setSelectedVideo(null)} /> : null}
      </Modal>
    </ImageBackground>
  );
}

function PodcastVideoCard({ video, onPress }) {
  const [duration, setDuration] = useState(0);

  const previewPlayer = useVideoPlayer(video.uri, (player) => {
    player.muted = true;
    player.pause();
    player.currentTime = 0.5;
  });

  useEffect(() => {
    const sub = previewPlayer.addListener('sourceLoad', (payload) => {
      if (Number.isFinite(payload?.duration) && payload.duration > 0) {
        setDuration(payload.duration);
      }
      try {
        previewPlayer.currentTime = 0.5;
        previewPlayer.pause();
      } catch {}
    });
    return () => {
      sub.remove();
      try {
        previewPlayer.pause();
      } catch {}
    };
  }, [previewPlayer]);

  return (
    <View style={styles.videoCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Play ${video.name}`}
        onPress={onPress}
        style={({ pressed }) => [styles.videoMain, pressed && styles.videoPressed]}
      >
        <View style={styles.videoPreview}>
          <VideoView
            player={previewPlayer}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
            surfaceType={Platform.OS === 'android' ? 'textureView' : undefined}
            pointerEvents="none"
          />
          <View style={styles.videoOverlay} pointerEvents="none">
            <View style={styles.videoPlayBadge}>
              <Ionicons name="play" size={26} color="#ffffff" style={{ marginLeft: 3 }} />
            </View>
          </View>
          {duration > 0 ? (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{formatDuration(duration)}</Text>
            </View>
          ) : null}
          <View style={styles.videoTag}>
            <Text style={styles.videoTagText}>PODCAST</Text>
          </View>
        </View>

        <View style={styles.videoDetailsRow}>
          <View style={styles.videoDetails}>
            <Text numberOfLines={2} style={styles.videoName}>{video.name}</Text>
            <Text style={styles.videoType}>Podcast Video • Tap to play</Text>
          </View>
          <View style={styles.playActionPill}>
            <Ionicons name="play-circle" size={28} color={COLORS.green} />
          </View>
        </View>
      </Pressable>
    </View>
  );
}

function PodcastVideoPlayer({ video, onClose }) {
  const player = useVideoPlayer(video.uri, (videoPlayer) => {
    videoPlayer.play();
  });

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {}
    };
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
      <Text numberOfLines={1} style={styles.playingName}>{video.name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  videoMain: { minWidth: 0 },
  videoPressed: { opacity: 0.9 },
  videoPreview: { width: '100%', aspectRatio: 16 / 9, overflow: 'hidden', backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  videoOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
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
  playerScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  fullVideo: { width: '100%', flex: 1 },
  closeButton: { position: 'absolute', top: 52, right: 20, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 10 },
  playingName: { position: 'absolute', top: 60, left: 20, right: 76, color: '#fff', fontFamily: 'NunitoBold', fontSize: 16, textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 4 },
});
