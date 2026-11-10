import { useMemo } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { ImageBackground } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import christmasBackground from '../assets/christmas_bg4.png';
import { usePlayback } from '../components/PlaybackContext';
import SongArtwork from '../components/SongArtwork';

export default function RecentlyPlayed() {
  const insets = useSafeAreaInsets();
  const { currentTrack, playTrack, playQueue, recentlyPlayed, tracks } = usePlayback();
  const entries = useMemo(() => recentlyPlayed.map((entry) => ({
    ...entry,
    track: entry.type === 'track' ? tracks.find((track) => track.id === entry.id) ?? null : null,
  })), [recentlyPlayed, tracks]);

  const playEntry = (entry) => {
    if (entry.type === 'track') {
      if (!entry.track?.source) return;
      playTrack(entry.track);
      router.push('/Player');
      return;
    }
    const trackIds = entry.trackIds ?? entry.tracks?.map((t) => t.id) ?? [];
    const albumTracks = trackIds.map((id) => tracks.find((track) => track.id === id)).filter((track) => track?.source);
    if (!albumTracks.length) {
      router.push({ pathname: '/Albums', params: { albumId: entry.id } });
      return;
    }
    playQueue(albumTracks, albumTracks[0], { ...entry, trackIds });
    router.push('/Player');
  };

  return (
    <ImageBackground source={christmasBackground} contentFit="cover" style={styles.background}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.screen, { paddingTop: insets.top + 40 }]}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
            <Ionicons name="chevron-back" size={25} color={COLORS.ink} />
          </Pressable>
          <View style={styles.headingCopy}>
            <Text style={styles.heading}>Recently Played</Text>
            <Text style={styles.subheading}>History clears after 24 hours</Text>
          </View>
        </View>

        {entries.length ? (
          <ScrollView contentContainerStyle={[styles.list, { paddingBottom: currentTrack ? Math.max(insets.bottom, 8) + 92 : insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
            {entries.map((entry) => {
              const isTrack = entry.type === 'track';
              const image = isTrack ? entry.track?.artwork : entry.artworkUri ? { uri: entry.artworkUri } : null;
              const title = isTrack ? entry.track?.title ?? entry.title : entry.title;
              const subtitle = isTrack
                ? entry.track?.artist ?? entry.artist ?? 'No longer in your library'
                : `Playlist · ${entry.trackIds.length} song${entry.trackIds.length === 1 ? '' : 's'}`;
              const playable = isTrack ? Boolean(entry.track?.source) : entry.trackIds.some((id) => tracks.some((track) => track.id === id && track.source));
              return (
                <Pressable
                  key={`${entry.type}:${entry.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${playable ? 'Play' : 'Open'} ${title}, ${subtitle}`}
                  disabled={!playable && isTrack}
                  onPress={() => playEntry(entry)}
                  style={styles.row}
                >
                  <SongArtwork source={image} style={styles.art} iconSize={22} />
                  <View style={styles.details}>
                    <Text numberOfLines={1} style={styles.title}>{title}</Text>
                    <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text>
                  </View>
                  <Ionicons name={playable ? 'play' : 'chevron-forward'} size={20} color={COLORS.green} />
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <View style={styles.empty}>
            <Ionicons name="time-outline" size={34} color={COLORS.green} />
            <Text style={styles.emptyTitle}>No recent plays</Text>
            <Text style={styles.emptyText}>Songs and playlists you play will appear here for 24 hours.</Text>
          </View>
        )}
      </View>
    </ImageBackground>
  );
}

const COLORS = { green: '#174d38', ink: '#28251f', muted: '#817764', cream: '#fff8e9' };

const styles = StyleSheet.create({
  background: { flex: 1 },
  screen: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  backButton: { width: 34, height: 40, justifyContent: 'center' },
  headingCopy: { flex: 1 },
  heading: { color: COLORS.ink, fontFamily: 'NunitoExtraBold', fontSize: 22 },
  subheading: { color: COLORS.muted, fontFamily: 'NunitoSemiBold', fontSize: 12, marginTop: 1 },
  list: { gap: 5, paddingBottom: 20 },
  row: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 },
  art: { width: 54, height: 54, borderRadius: 9, backgroundColor: '#d9c7a4' },
  details: { flex: 1, minWidth: 0 },
  title: { color: COLORS.ink, fontFamily: 'NunitoBold', fontSize: 14 },
  subtitle: { color: COLORS.muted, fontFamily: 'NunitoRegular', fontSize: 12, marginTop: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 40 },
  emptyTitle: { color: COLORS.ink, fontFamily: 'NunitoExtraBold', fontSize: 17, marginTop: 10 },
  emptyText: { color: COLORS.muted, fontFamily: 'NunitoRegular', fontSize: 13, lineHeight: 19, marginTop: 4, textAlign: 'center' },
});
