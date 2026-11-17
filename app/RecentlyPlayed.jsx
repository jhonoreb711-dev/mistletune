import { useMemo } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
<<<<<<< HEAD
import ThemeImageBackground from '../components/ThemeImageBackground';
=======
import { ImageBackground } from 'expo-image';
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

<<<<<<< HEAD
import { useTheme, useThemeStyles } from '../themes/ThemeProvider';
=======
import christmasBackground from '../assets/christmas_bg4.png';
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
import { usePlayback } from '../components/PlaybackContext';
import SongArtwork from '../components/SongArtwork';

export default function RecentlyPlayed() {
<<<<<<< HEAD
  const { styles, colors: COLORS } = useThemeStyles(createStyles, BASE_COLORS);
  const { theme } = useTheme();
  const needsLightText = theme.id !== 'halloween';
=======
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
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
<<<<<<< HEAD
    <ThemeImageBackground source={theme.assets.collection} contentFit="cover" autoplay style={styles.background}>
      <StatusBar barStyle={needsLightText ? 'light-content' : 'dark-content'} />
      <View style={[styles.screen, theme.id === 'halloween' && { backgroundColor: 'rgba(255,241,220,0.9)' }, { paddingTop: insets.top + 40 }]}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
            <Ionicons name="chevron-back" size={25} color={needsLightText ? COLORS.cream : COLORS.ink} />
          </Pressable>
          <View style={styles.headingCopy}>
            <Text style={[styles.heading, needsLightText && { color: COLORS.cream }]}>Recently Played</Text>
            <Text style={[styles.subheading, needsLightText && { color: COLORS.onSurfaceMuted }]}>History clears after 24 hours</Text>
=======
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
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
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
<<<<<<< HEAD
                : `Playlist Â· ${entry.trackIds.length} song${entry.trackIds.length === 1 ? '' : 's'}`;
=======
                : `Playlist · ${entry.trackIds.length} song${entry.trackIds.length === 1 ? '' : 's'}`;
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
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
<<<<<<< HEAD
                    <Text numberOfLines={1} style={[styles.title, needsLightText && { color: COLORS.cream }]}>{title}</Text>
                    <Text numberOfLines={1} style={[styles.subtitle, needsLightText && { color: COLORS.onSurfaceMuted }]}>{subtitle}</Text>
=======
                    <Text numberOfLines={1} style={styles.title}>{title}</Text>
                    <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text>
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
                  </View>
                  <Ionicons name={playable ? 'play' : 'chevron-forward'} size={20} color={COLORS.green} />
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <View style={styles.empty}>
            <Ionicons name="time-outline" size={34} color={COLORS.green} />
<<<<<<< HEAD
            <Text style={[styles.emptyTitle, needsLightText && { color: COLORS.cream }]}>No recent plays</Text>
            <Text style={[styles.emptyText, needsLightText && { color: COLORS.onSurfaceMuted }]}>Songs and playlists you play will appear here for 24 hours.</Text>
          </View>
        )}
      </View>
    </ThemeImageBackground>
  );
}

const BASE_COLORS = { green: '#174d38', surfaceRaised: '#103b2d', ink: '#28251f', muted: '#817764', cream: '#fff8e9' };

const createStyles = (COLORS) => StyleSheet.create({
=======
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
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
  background: { flex: 1 },
  screen: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  backButton: { width: 34, height: 40, justifyContent: 'center' },
  headingCopy: { flex: 1 },
  heading: { color: COLORS.ink, fontFamily: 'NunitoExtraBold', fontSize: 22 },
  subheading: { color: COLORS.muted, fontFamily: 'NunitoSemiBold', fontSize: 12, marginTop: 1 },
  list: { gap: 5, paddingBottom: 20 },
  row: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 },
<<<<<<< HEAD
  art: { width: 54, height: 54, borderRadius: 9, backgroundColor: COLORS.surfaceRaised },
=======
  art: { width: 54, height: 54, borderRadius: 9, backgroundColor: '#d9c7a4' },
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
  details: { flex: 1, minWidth: 0 },
  title: { color: COLORS.ink, fontFamily: 'NunitoBold', fontSize: 14 },
  subtitle: { color: COLORS.muted, fontFamily: 'NunitoRegular', fontSize: 12, marginTop: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 40 },
  emptyTitle: { color: COLORS.ink, fontFamily: 'NunitoExtraBold', fontSize: 17, marginTop: 10 },
  emptyText: { color: COLORS.muted, fontFamily: 'NunitoRegular', fontSize: 13, lineHeight: 19, marginTop: 4, textAlign: 'center' },
});
<<<<<<< HEAD

=======
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
