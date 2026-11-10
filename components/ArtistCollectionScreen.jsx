import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { ImageBackground } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import christmasBackground from '../assets/christmas_bg4.png';
import { usePlayback } from './PlaybackContext';
import SongArtwork from './SongArtwork';
import { buildArtistCollections } from './artistLibrary';
import { getArtistCovers, pickArtistCover, removeArtistCover } from './artistArtwork';

export default function ArtistCollectionScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const requestedArtist = typeof params.artist === 'string' ? params.artist : '';
  const { libraryId, tracks, playQueue } = usePlayback();
  const [coverUri, setCoverUri] = useState(null);
  const [isPickingCover, setIsPickingCover] = useState(false);
  const collection = useMemo(
    () => buildArtistCollections(tracks).find((item) => item.id === requestedArtist.toLocaleLowerCase()),
    [requestedArtist, tracks]
  );

  useEffect(() => {
    let active = true;
    getArtistCovers(libraryId).then((covers) => {
      if (active) setCoverUri(covers[collection?.id] ?? null);
    });
    return () => { active = false; };
  }, [collection?.id, libraryId]);

  const changeCover = async () => {
    if (!collection || isPickingCover) return;
    setIsPickingCover(true);
    try {
      const nextCover = await pickArtistCover(libraryId, collection.id);
      if (nextCover) setCoverUri(nextCover);
    } catch (error) {
      Alert.alert('Could not update artist cover', error.message || 'Please try again.');
    } finally {
      setIsPickingCover(false);
    }
  };

  const resetCover = async () => {
    if (!collection || !coverUri) return;
    try {
      await removeArtistCover(libraryId, collection.id);
      setCoverUri(null);
    } catch (error) {
      Alert.alert('Could not remove artist cover', error.message || 'Please try again.');
    }
  };

  const playArtistTracks = (selectedTrack) => {
    if (!collection?.tracks.length) return;
    playQueue(collection.tracks, selectedTrack ?? collection.tracks[0]);
    router.push('/Player');
  };

  return (
    <ImageBackground source={christmasBackground} contentFit="cover" style={styles.background}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to Home" onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={25} color={COLORS.ink} />
          </Pressable>
          <Text numberOfLines={1} style={styles.heading}>{collection?.artist ?? requestedArtist ?? 'Artist'}</Text>
        </View>

        {collection ? (
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]} showsVerticalScrollIndicator={false}>
            <View style={styles.artistSummary}>
              <SongArtwork source={coverUri ? { uri: coverUri } : collection.artwork} style={styles.cover} iconSize={56} />
              <Text style={styles.artistName}>{collection.artist}</Text>
              <Text style={styles.songCount}>{collection.tracks.length} {collection.tracks.length === 1 ? 'song' : 'songs'}</Text>
              <Pressable accessibilityRole="button" onPress={() => playArtistTracks()} style={styles.playAllButton}>
                <Ionicons name="play" size={18} color={COLORS.cream} />
                <Text style={styles.playAllText}>Play collection</Text>
              </Pressable>
              <View style={styles.coverActions}>
                <Pressable accessibilityRole="button" disabled={isPickingCover} onPress={changeCover} style={styles.coverButton}>
                  <Ionicons name="image-outline" size={17} color={COLORS.green} />
                  <Text style={styles.coverButtonText}>{isPickingCover ? 'Choosing image...' : coverUri ? 'Change cover art' : 'Add cover art'}</Text>
                </Pressable>
                {coverUri ? (
                  <Pressable accessibilityRole="button" onPress={resetCover} style={styles.coverButton}>
                    <Ionicons name="refresh-outline" size={17} color={COLORS.green} />
                    <Text style={styles.coverButtonText}>Use default</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <View style={styles.trackList}>
              {collection.tracks.map((track) => (
                <Pressable
                  key={track.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Play ${track.title} by ${track.artist || 'Unknown artist'}`}
                  onPress={() => playArtistTracks(track)}
                  style={styles.trackRow}
                >
                  <SongArtwork source={track.artwork} style={styles.trackArt} iconSize={19} />
                  <View style={styles.trackDetails}>
                    <Text numberOfLines={1} style={styles.trackTitle}>{track.title}</Text>
                    <Text numberOfLines={1} style={styles.trackArtist}>{track.artist || 'Unknown artist'}</Text>
                  </View>
                  <Ionicons name="play-circle-outline" size={24} color={COLORS.green} />
                </Pressable>
              ))}
            </View>
          </ScrollView>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="person-outline" size={32} color={COLORS.green} />
            <Text style={styles.emptyText}>No songs found for this artist.</Text>
          </View>
        )}
      </View>
    </ImageBackground>
  );
}

const COLORS = { green: '#164d38', ink: '#29251e', muted: '#655c4e', cream: '#fff8e9' };

const styles = StyleSheet.create({
  background: { flex: 1, width: '100%' },
  screen: { flex: 1, backgroundColor: 'transparent' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12 },
  backButton: { width: 36, height: 40, justifyContent: 'center', marginRight: 5 },
  heading: { flex: 1, color: COLORS.ink, fontFamily: 'NunitoExtraBold', fontSize: 21 },
  content: { paddingHorizontal: 20 },
  artistSummary: { alignItems: 'center', paddingVertical: 10, marginBottom: 12 },
  cover: { width: 190, height: 190, borderRadius: 18, backgroundColor: '#d9c7a4' },
  artistName: { color: COLORS.ink, fontFamily: 'NunitoExtraBold', fontSize: 23, marginTop: 14, textAlign: 'center' },
  songCount: { color: COLORS.muted, fontFamily: 'NunitoSemiBold', fontSize: 13, marginTop: 3 },
  playAllButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20, marginTop: 14, borderRadius: 22, backgroundColor: COLORS.green },
  playAllText: { color: COLORS.cream, fontFamily: 'NunitoExtraBold', fontSize: 13 },
  coverActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 10 },
  coverButton: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 11, borderWidth: 1, borderColor: 'rgba(22,77,56,0.45)', borderRadius: 18, backgroundColor: 'rgba(255,248,233,0.7)' },
  coverButtonText: { color: COLORS.green, fontFamily: 'NunitoBold', fontSize: 11 },
  trackList: { gap: 8 },
  trackRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 8, borderRadius: 12, backgroundColor: 'rgba(255,248,233,0.74)' },
  trackArt: { width: 42, height: 42, borderRadius: 7, backgroundColor: '#d9c7a4' },
  trackDetails: { flex: 1, minWidth: 0 },
  trackTitle: { color: COLORS.ink, fontFamily: 'NunitoBold', fontSize: 13 },
  trackArtist: { color: COLORS.muted, fontFamily: 'NunitoRegular', fontSize: 11, marginTop: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { color: COLORS.ink, fontFamily: 'NunitoSemiBold', fontSize: 14 },
});
