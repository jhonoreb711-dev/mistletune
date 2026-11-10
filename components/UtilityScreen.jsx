import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ImageBackground } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import christmasSearchBackground from '../assets/christmas_search_combined.gif';
import christmasLibraryBackground from '../assets/Animated_Christmas_Music_Bookshelf.gif';
import { usePlayback } from './PlaybackContext';
import SongArtwork from './SongArtwork';
import { getUserAlbums } from './userAlbums';
import { useFavorites } from './FavoritesContext';
import { buildAlbums } from './albumLibrary';

const searchCategories = ['All', 'Songs', 'Albums'];
const libraryCategories = ['Favorites', 'Songs', 'Albums'];

export default function UtilityScreen({ page }) {
  const params = useLocalSearchParams();
  const query = typeof params.query === 'string' ? params.query : '';
  const category = typeof params.category === 'string' ? params.category : '';
  const requestId = typeof params.requestId === 'string' ? params.requestId : '';
  const autoPlay = params.autoPlay === '1';
  return <UtilityContent key={JSON.stringify([page, query, category, requestId])} page={page} initialQuery={query} initialCategory={category} autoPlay={autoPlay} />;
}

function UtilityContent({ page, initialQuery, initialCategory, autoPlay = false }) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState(initialQuery);
  const [searchCategory, setSearchCategory] = useState(searchCategories.includes(initialCategory) ? initialCategory : 'All');
  const [libraryCategory, setLibraryCategory] = useState(libraryCategories.includes(initialCategory) ? initialCategory : 'Songs');
  const [librarySortAscending, setLibrarySortAscending] = useState(true);
  const [selectedLibraryAlbumId, setSelectedLibraryAlbumId] = useState(null);
  const [savedAlbums, setSavedAlbums] = useState([]);
  const isSearch = page === 'Search';
  const isLibrary = !isSearch;
  const { libraryId, playTrack, tracks } = usePlayback();
  const { favoriteTrackIds, favoriteAlbumIds } = useFavorites();
  useEffect(() => {
    let isMounted = true;
    getUserAlbums(libraryId).then((userAlbums) => {
      if (isMounted) setSavedAlbums(userAlbums);
    });
    return () => { isMounted = false; };
  }, [libraryId]);
  const libraryAlbums = useMemo(() => buildAlbums(tracks), [tracks]);
  const albumItems = useMemo(() => [
    ...savedAlbums.map((album) => {
      const albumTracks = album.trackIds.map((id) => tracks.find((track) => track.id === id)).filter(Boolean);
      const songCount = `${albumTracks.length} song${albumTracks.length === 1 ? '' : 's'}`;
      const albumWithTracks = { ...album, tracks: albumTracks, detail: songCount };
      return {
        id: album.id,
        title: albumWithTracks.title,
        subtitle: `Playlist · ${songCount}`,
        type: 'Album',
        image: albumWithTracks.artworkUri ? { uri: albumWithTracks.artworkUri } : null,
        album: albumWithTracks,
      };
    }),
    ...libraryAlbums.map((album) => ({
      id: album.id,
      title: album.title,
      subtitle: `${album.artist} · ${album.detail}`,
      type: 'Album',
      image: album.artwork,
      album,
    })),
  ], [savedAlbums, libraryAlbums, tracks]);
  const searchableItems = useMemo(() => [
    ...tracks.map((track) => ({ id: track.id, title: track.title, subtitle: `${track.artist} - Song`, type: 'Music', image: track.artwork, track })),
    ...albumItems,
  ], [albumItems, tracks]);
  const libraryItems = {
    Favorites: [
      ...tracks.filter((track) => favoriteTrackIds.includes(track.id)).map((track) => ({ id: track.id, title: track.title, subtitle: `${track.artist} - Song`, type: 'Music', image: track.artwork, track })),
      ...albumItems.filter((album) => favoriteAlbumIds.includes(album.id)),
    ],
    Songs: tracks.map((track) => ({ id: track.id, title: track.title, subtitle: `${track.artist} - Song`, type: 'Music', image: track.artwork, track })),
    Albums: albumItems,
  };

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return searchableItems.filter((item) => {
      const matchesCategory = searchCategory === 'All'
        || (searchCategory === 'Songs' && item.type === 'Music')
        || (searchCategory === 'Albums' && item.type === 'Album');
      const matchesQuery = !normalizedQuery
        || `${item.title} ${item.subtitle}`.toLocaleLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [query, searchCategory, searchableItems]);

  const selectedLibraryAlbum = albumItems.find((item) => item.id === selectedLibraryAlbumId);
  const albumTracks = selectedLibraryAlbum?.album.tracks.map((track) => ({
    id: track.id,
    title: track.title,
    subtitle: `${track.artist} - Song`,
    type: 'Music',
    image: track.artwork,
    track,
  }));
  const items = isSearch ? results : albumTracks ?? libraryItems[libraryCategory];
  const visibleItems = isLibrary
    ? [...items].sort((first, second) => (first.title || '').localeCompare(second.title || '', undefined, { sensitivity: 'base', numeric: true }) * (librarySortAscending ? 1 : -1))
    : items;

  const autoPlayTriggered = useRef(false);
  useEffect(() => {
    if (autoPlay && isSearch && !autoPlayTriggered.current && results.length > 0 && results[0].track) {
      autoPlayTriggered.current = true;
      playTrack(results[0].track);
    }
  }, [autoPlay, isSearch, playTrack, results]);

  return (
    <ImageBackground source={isSearch ? christmasSearchBackground : christmasLibraryBackground} contentFit="cover" autoplay style={styles.background}>
      <StatusBar barStyle="light-content" />
      <View style={styles.screen}>
        <View style={[styles.header, isSearch && styles.searchHeader, isLibrary && styles.libraryHeader, { paddingTop: insets.top + 42 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to previous screen"
            onPress={() => selectedLibraryAlbum ? setSelectedLibraryAlbumId(null) : router.back()}
            style={[styles.backButton, (isSearch || isLibrary) && styles.searchBackButton]}
          >
            <Ionicons name="chevron-back" size={25} color={SEARCH_COLORS.gold} />
          </Pressable>
          <Text numberOfLines={1} style={[styles.heading, styles.searchHeading]}>{isSearch ? 'Search' : selectedLibraryAlbum?.title ?? 'Your Library'}</Text>
        </View>

        {isSearch ? (
          <>
            <View style={[styles.searchBox, styles.christmasSearchBox]}>
              <Ionicons name="search-outline" size={20} color={SEARCH_COLORS.green} />
              <TextInput
              accessibilityLabel="Search songs and albums"
                value={query}
                onChangeText={setQuery}
                placeholder="What do you want to listen to?"
                placeholderTextColor={SEARCH_COLORS.muted}
                returnKeyType="search"
                style={[styles.searchInput, styles.christmasSearchInput]}
              />
              {query.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  onPress={() => setQuery('')}
                  hitSlop={8}
                >
                  <Ionicons name="close-circle" size={19} color={SEARCH_COLORS.green} />
                </Pressable>
              )}
            </View>

            <View style={[styles.filters, styles.christmasFilters]}>
              {searchCategories.map((category) => {
                const selected = searchCategory === category;
                const categoryIcon = category === 'All' ? 'grid' : category === 'Songs' ? 'musical-note' : 'albums';
                return (
                  <Pressable
                    key={category}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setSearchCategory(category)}
                    style={[styles.filterButton, styles.christmasFilterButton, selected && styles.christmasFilterButtonSelected]}
                  >
                    <View style={[styles.searchFilterIconFrame, selected && styles.searchFilterIconFrameSelected]}>
                      <Ionicons name={categoryIcon} size={27} color={SEARCH_COLORS.gold} />
                    </View>
                    <Text style={[styles.filterLabel, styles.christmasFilterLabel, selected && styles.filterLabelSelected]}>{category}</Text>
                    {selected ? <View style={styles.searchFilterRibbon} /> : null}
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.sectionTitle, isSearch && styles.christmasSectionTitle]}>
              {query.trim()
                ? 'Search results'
                : searchCategory === 'Songs' ? 'Songs' : searchCategory === 'Albums' ? 'Albums' : 'Browse music'}
            </Text>
            {query.trim() || searchCategory !== 'All' ? (
              <ItemList items={items} bottomInset={insets.bottom} christmas={isSearch} onSelect={(item) => {
                if (item.track) { playTrack(item.track); router.push('/Player'); }
                else router.push({ pathname: '/Albums', params: { albumId: item.album?.routeId ?? item.id } });
              }} />
            ) : (
              <View style={[styles.browseCards, styles.christmasBrowseCards]}>
                <Pressable accessibilityRole="button" onPress={() => router.push('/Albums')} style={[styles.browseCard, styles.christmasBrowseCard, styles.albumBrowseCard]}>
                  <Text style={styles.cardSnowflakeTop}>❄</Text>
                  <Text style={[styles.browseCardTitle, styles.christmasBrowseCardTitle]}>Albums</Text>
                  <Text style={[styles.browseCardSubtitle, styles.christmasBrowseCardSubtitle]}>Browse by album</Text>
                  <Ionicons name="musical-notes" size={42} color={SEARCH_COLORS.gold} style={styles.browseIcon} />
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => router.push('/Library')} style={[styles.browseCard, styles.christmasBrowseCard, styles.songBrowseCard]}>
                  <Text style={styles.cardSnowflakeTop}>❄</Text>
                  <Text style={[styles.browseCardTitle, styles.christmasBrowseCardTitle]}>Songs</Text>
                  <Text style={[styles.browseCardSubtitle, styles.christmasBrowseCardSubtitle]}>Browse your music</Text>
                  <Ionicons name="headset" size={40} color={SEARCH_COLORS.gold} style={styles.browseIcon} />
                </Pressable>
              </View>
            )}
          </>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.libraryBookFilters}
              style={styles.libraryFilterScroll}
            >
              {!selectedLibraryAlbum ? libraryCategories.map((category) => {
                const selected = libraryCategory === category;
                const categoryIcon = category === 'Favorites' ? 'heart' : category === 'Songs' ? 'musical-note' : 'albums';
                return (
                  <Pressable
                    key={category}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setLibraryCategory(category)}
                    style={[styles.libraryBookCard, category === 'Songs' && styles.librarySongsBook, selected && styles.libraryBookCardSelected]}
                  >
                    <View style={[styles.libraryBookIconFrame, selected && styles.libraryBookIconFrameSelected]}>
                      <Ionicons name={categoryIcon} size={30} color={SEARCH_COLORS.gold} />
                    </View>
                    <Text style={styles.libraryBookLabel}>{category}</Text>
                    {selected ? <View style={styles.libraryBookRibbon} /> : null}
                  </Pressable>
                );
              }) : null}
            </ScrollView>
            <View style={styles.librarySection}>
              <View style={styles.libraryShelfHeading}>
                <Text numberOfLines={1} style={styles.libraryShelfTitle}>
                  {'♫ '}{selectedLibraryAlbum ? selectedLibraryAlbum.subtitle : libraryCategory === 'Albums' ? 'Your Albums' : libraryCategory === 'Favorites' ? 'Favorites' : 'Your Songs'}
                </Text>
                <View style={styles.libraryActions}>
                  <Pressable accessibilityRole="button" accessibilityLabel="Search music" onPress={() => router.push('/Search')} style={styles.libraryActionButton}>
                    <Ionicons name="search-outline" size={22} color={SEARCH_COLORS.gold} />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Sort ${librarySortAscending ? 'Z to A' : 'A to Z'}`} onPress={() => setLibrarySortAscending((ascending) => !ascending)} style={styles.libraryActionButton}>
                    <Ionicons name="options-outline" size={22} color={SEARCH_COLORS.gold} />
                  </Pressable>
                </View>
              </View>
              <ItemList items={visibleItems} bottomInset={insets.bottom} compact christmas emptyMessage={libraryCategory === 'Favorites' ? 'No favorites yet. Tap a heart on a song or album to save it here.' : 'No music here yet. Add songs in Settings.'} onSelect={(item) => {
                if (item.track) { playTrack(item.track); router.push('/Player'); }
                else if (item.album) router.push({ pathname: '/Albums', params: { albumId: item.album.routeId ?? item.id } });
                else router.push('/Albums');
              }} />
            </View>
          </>
        )}

        <View style={[styles.bottomBar, styles.christmasBottomBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <NavItem label="Home" icon="home" selected={false} christmas onPress={() => router.replace('/Music')} />
          <NavItem label="Search" icon="search" selected={isSearch} christmas onPress={() => isSearch ? null : router.replace('/Search')} />
          <NavItem label="Your Library" icon="library" selected={isLibrary} christmas onPress={() => isSearch ? router.replace('/Library') : null} />
          <NavItem label="Settings" icon="settings" selected={false} christmas onPress={() => router.replace('/Settings')} />
        </View>
      </View>
    </ImageBackground>
  );
}

function ItemList({ items, bottomInset, compact = false, christmas = false, onSelect, emptyMessage }) {
  return (
    <ScrollView
      contentContainerStyle={[
        styles.itemList,
        compact && styles.compactItemList,
        { paddingBottom: Math.max(bottomInset, 8) + (compact ? 60 : 72) },
      ]}
      style={compact && styles.libraryList}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {items.length > 0 ? items.map((item) => (
        <Pressable key={`${item.title}-${item.subtitle}`} accessibilityRole="button" onPress={() => onSelect?.(item)} style={[styles.itemRow, compact && styles.compactItemRow, christmas && styles.christmasItemRow]}>
          <SongArtwork source={item.image} style={[styles.itemArt, compact && styles.compactItemArt, christmas && styles.christmasItemArt]} iconSize={22} />
          <View style={styles.itemDetails}>
            <Text numberOfLines={1} style={[styles.itemTitle, christmas && styles.christmasItemTitle]}>{item.title}</Text>
            <Text numberOfLines={1} style={[styles.itemSubtitle, christmas && styles.christmasItemSubtitle]}>{item.subtitle}</Text>
          </View>
          <Ionicons name={christmas && item.track ? 'play-circle-outline' : 'chevron-forward'} size={christmas && item.track ? 31 : 19} color={christmas ? SEARCH_COLORS.gold : COLORS.green} />
        </Pressable>
      )) : (
        <Text style={styles.emptyMessage}>{emptyMessage ?? (compact ? 'No music here yet. Add songs in Settings.' : 'No results found. Try another search.')}</Text>
      )}
    </ScrollView>
  );
}

function NavItem({ label, icon, selected, christmas = false, onPress }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={styles.navItem}>
      <Ionicons
        name={selected ? icon : `${icon}-outline`}
        size={21}
        color={christmas ? (selected ? SEARCH_COLORS.cream : SEARCH_COLORS.gold) : selected ? COLORS.red : COLORS.muted}
      />
      <Text style={[styles.navLabel, selected && styles.navLabelSelected, christmas && styles.christmasNavLabel, christmas && selected && styles.christmasNavLabelSelected]}>{label}</Text>
      {christmas ? <View style={[styles.searchNavIndicator, selected && styles.searchNavIndicatorActive]} /> : null}
    </Pressable>
  );
}

const COLORS = {
  green: '#174d38',
  red: '#a62224',
  ink: '#28251f',
  muted: '#817764',
  cream: '#fff8e9',
};

const SEARCH_COLORS = {
  green: '#0b3b25',
  red: '#a20d1b',
  gold: '#f5c96b',
  cream: '#fff4d5',
  muted: '#746c59',
};

const styles = StyleSheet.create({
  background: { flex: 1, width: '100%' },
  screen: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  searchHeader: { paddingBottom: 18 },
  libraryHeader: { paddingBottom: 4 },
  backButton: { width: 34, height: 36, justifyContent: 'center', marginRight: 4 },
  heading: { color: COLORS.ink, fontFamily: 'NunitoExtraBold', fontSize: 22 },
  searchHeading: { color: SEARCH_COLORS.cream, fontSize: 25, textShadowColor: 'rgba(0,0,0,0.65)', textShadowRadius: 5 },
  searchBackButton: { borderRadius: 18, backgroundColor: 'rgba(4, 38, 24, 0.48)' },
  searchBox: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 18,
    paddingHorizontal: 14,
    borderRadius: 13,
    backgroundColor: COLORS.cream,
  },
  christmasSearchBox: {
    height: 54,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 248, 230, 0.97)',
    borderWidth: 2,
    borderColor: SEARCH_COLORS.gold,
    shadowColor: SEARCH_COLORS.gold,
    shadowOpacity: 0.48,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 8, color: COLORS.ink, fontFamily: 'NunitoSemiBold', fontSize: 13 },
  christmasSearchInput: { color: SEARCH_COLORS.green, fontSize: 14 },
  filters: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 14, marginBottom: 18 },
  christmasFilters: { height: 116, paddingHorizontal: 18, alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 17 },
  libraryFilterScroll: { flexGrow: 0, flexShrink: 0, height: 126 },
  libraryFilters: { gap: 9, paddingHorizontal: 20, paddingBottom: 0 },
  libraryBookFilters: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 12 },
  libraryBookCard: { width: 96, height: 104, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 8, borderRadius: 15, borderWidth: 2, borderColor: SEARCH_COLORS.gold, backgroundColor: '#8e1420', shadowColor: SEARCH_COLORS.gold, shadowOpacity: 0.28, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  librarySongsBook: { backgroundColor: '#0b452d' },
  libraryBookCardSelected: { backgroundColor: '#0b452d', borderColor: '#ffdf82', shadowOpacity: 0.7, shadowRadius: 11, elevation: 5, transform: [{ translateY: -3 }] },
  libraryBookIconFrame: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderWidth: 1, borderColor: 'rgba(245,201,107,0.7)', backgroundColor: 'rgba(23,6,5,0.22)' },
  libraryBookIconFrameSelected: { borderColor: '#ffe7a3', backgroundColor: 'rgba(0,25,15,0.4)' },
  libraryBookLabel: { color: SEARCH_COLORS.cream, fontFamily: 'NunitoExtraBold', fontSize: 13, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3 },
  libraryBookRibbon: { position: 'absolute', bottom: -10, width: 16, height: 17, backgroundColor: SEARCH_COLORS.red, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  filterButton: {
    minWidth: 72,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: COLORS.cream,
  },
  filterButtonSelected: { backgroundColor: COLORS.green },
  filterLabel: { color: COLORS.ink, fontFamily: 'NunitoBold', fontSize: 12 },
  filterLabelSelected: { color: COLORS.cream },
  christmasFilterButton: { width: 88, minWidth: 88, height: 104, gap: 8, paddingHorizontal: 7, borderRadius: 13, backgroundColor: '#8e1420', borderWidth: 2, borderColor: SEARCH_COLORS.gold, shadowColor: SEARCH_COLORS.gold, shadowOpacity: 0.28, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  christmasFilterButtonSelected: { backgroundColor: '#0b452d', borderColor: '#ffe8a5', shadowOpacity: 0.7, shadowRadius: 10, elevation: 5, transform: [{ translateY: -3 }] },
  searchFilterIconFrame: { width: 48, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(245,201,107,0.72)', backgroundColor: 'rgba(23,6,5,0.22)' },
  searchFilterIconFrameSelected: { borderColor: '#ffe7a3', backgroundColor: 'rgba(0,25,15,0.4)' },
  christmasFilterLabel: { color: SEARCH_COLORS.cream, fontSize: 12, fontFamily: 'NunitoExtraBold' },
  searchFilterRibbon: { position: 'absolute', bottom: -10, width: 16, height: 17, backgroundColor: SEARCH_COLORS.red, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  sectionTitle: { marginHorizontal: 20, marginBottom: 10, color: COLORS.ink, fontFamily: 'NunitoExtraBold', fontSize: 17 },
  christmasSectionTitle: { color: SEARCH_COLORS.cream, fontSize: 20, textShadowColor: 'rgba(0,0,0,0.62)', textShadowRadius: 5 },
  librarySectionTitle: { marginTop: 0, marginBottom: 2 },
  librarySection: { flex: 1, minHeight: 0, marginTop: 8, paddingHorizontal: 18 },
  libraryShelfHeading: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 7 },
  libraryShelfTitle: { flexShrink: 1, color: SEARCH_COLORS.cream, fontFamily: 'NunitoExtraBold', fontSize: 19, paddingHorizontal: 13, paddingVertical: 6, borderWidth: 1.5, borderColor: SEARCH_COLORS.gold, borderRadius: 13, backgroundColor: 'rgba(5,43,27,0.84)', textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 4 },
  libraryActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  libraryActionButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, borderWidth: 1.5, borderColor: SEARCH_COLORS.gold, backgroundColor: 'rgba(4,36,23,0.82)' },
  libraryList: { flex: 1 },
  itemList: { gap: 5, paddingHorizontal: 18, paddingTop: 1 },
  compactItemList: { gap: 2, paddingTop: 0 },
  itemRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 5, paddingVertical: 5 },
  compactItemRow: { minHeight: 56, gap: 10, paddingVertical: 3 },
  itemArt: { width: 54, height: 54, borderRadius: 8, backgroundColor: '#d9c7a4' },
  compactItemArt: { width: 46, height: 46 },
  itemDetails: { flex: 1, minWidth: 0 },
  itemTitle: { color: COLORS.ink, fontFamily: 'NunitoExtraBold', fontSize: 14 },
  itemSubtitle: { color: '#5c554a', fontFamily: 'NunitoSemiBold', fontSize: 12 },
  emptyMessage: { marginHorizontal: 5, marginTop: 15, color: COLORS.muted, fontFamily: 'NunitoSemiBold', fontSize: 13 },
  browseCards: { flexDirection: 'row', gap: 12, paddingHorizontal: 18 },
  christmasBrowseCards: { gap: 12, paddingHorizontal: 18 },
  browseCard: { flex: 1, minHeight: 132, justifyContent: 'flex-end', overflow: 'hidden', padding: 14, borderRadius: 15 },
  christmasBrowseCard: { minHeight: 166, borderRadius: 19, borderWidth: 2, borderColor: SEARCH_COLORS.gold, shadowColor: SEARCH_COLORS.gold, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  albumBrowseCard: { backgroundColor: '#8d1520' },
  songBrowseCard: { backgroundColor: '#0b452d' },
  cardSnowflakeTop: { position: 'absolute', left: 10, top: 8, color: SEARCH_COLORS.cream, fontSize: 18, textShadowColor: SEARCH_COLORS.gold, textShadowRadius: 7 },
  musicCard: { backgroundColor: COLORS.green },
  browseCardTitle: { color: COLORS.cream, fontFamily: 'NunitoExtraBold', fontSize: 17 },
  browseCardSubtitle: { color: COLORS.cream, fontFamily: 'NunitoSemiBold', fontSize: 11 },
  christmasBrowseCardTitle: { color: SEARCH_COLORS.cream, fontSize: 19, textShadowColor: 'rgba(0,0,0,0.48)', textShadowRadius: 4 },
  christmasBrowseCardSubtitle: { color: SEARCH_COLORS.cream, fontSize: 12 },
  browseIcon: { position: 'absolute', right: 11, top: 12, opacity: 0.82 },
  christmasItemRow: { marginBottom: 6, minHeight: 70, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14, borderWidth: 1.25, borderColor: 'rgba(245,201,107,0.82)', backgroundColor: 'rgba(3,38,24,0.82)' },
  christmasItemArt: { borderWidth: 1.5, borderColor: SEARCH_COLORS.gold, borderRadius: 10, backgroundColor: '#103d2a' },
  christmasItemTitle: { color: SEARCH_COLORS.cream },
  christmasItemSubtitle: { color: SEARCH_COLORS.gold },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 7,
    backgroundColor: COLORS.cream,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(75, 59, 37, 0.2)',
  },
  christmasBottomBar: { minHeight: 72, backgroundColor: '#880b18', borderTopWidth: 1.5, borderTopColor: SEARCH_COLORS.gold },
  navItem: { flex: 1, minWidth: 0, alignItems: 'center', gap: 1 },
  navLabel: { color: COLORS.muted, fontFamily: 'NunitoSemiBold', fontSize: 10 },
  navLabelSelected: { color: COLORS.red, fontFamily: 'NunitoExtraBold' },
  christmasNavLabel: { color: SEARCH_COLORS.gold, fontSize: 11 },
  christmasNavLabelSelected: { color: SEARCH_COLORS.cream, textShadowColor: SEARCH_COLORS.gold, textShadowRadius: 5 },
  searchNavIndicator: { width: 38, height: 3, marginTop: 3, borderRadius: 2, backgroundColor: 'transparent' },
  searchNavIndicatorActive: { backgroundColor: SEARCH_COLORS.gold, shadowColor: SEARCH_COLORS.gold, shadowOpacity: 0.85, shadowRadius: 6, elevation: 3 },
});
