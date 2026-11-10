import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,

} from 'react-native';
import { Image, ImageBackground } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useIsFocused } from 'expo-router';
import { VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import christmasBackground from '../assets/christmas_twinkle_loop.gif';
import benjieHat from '../assets/Benjie_hat.png';
import { usePlayback } from '../components/PlaybackContext';
import SongArtwork from '../components/SongArtwork';
import { buildAlbums } from '../components/albumLibrary';
import { getUserAlbums } from '../components/userAlbums';
import { buildArtistCollections } from '../components/artistLibrary';
import { getArtistCovers } from '../components/artistArtwork';
import FadeInUp from '../components/FadeInUp';
import PressableScale from '../components/PressableScale';

const categories = [
  { label: 'All', icon: 'grid' },
  { label: 'My Albums', icon: 'albums' },
  { label: 'Podcast', icon: 'videocam' },
];
const ALPHABET_LETTERS = ['All', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), '#'];
let savedHomeVideoTime = 0;

function HomeVideo({ player, playing, currentTrack }) {
  const { homeVideoName, isCustomHomeVideo, changeHomeVideo, resetHomeVideo, isSpeechActive } = usePlayback();
  const [float] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  const benjieY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const benjieTilt = float.interpolate({ inputRange: [0, 1], outputRange: ['-1.5deg', '0.2deg'] });

  const isFocused = useIsFocused();
  const [controlsVisible, setControlsVisible] = useState(false);
  const [controlsOpacity] = useState(() => new Animated.Value(0));
  const controlsTimer = useRef(null);
  const [videoTime, setVideoTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [progressWidth, setProgressWidth] = useState(0);

  useEffect(() => {
    const timeSubscription = player.addListener('timeUpdate', ({ currentTime }) => {
      setVideoTime(currentTime);
      savedHomeVideoTime = currentTime;
    });
    const sourceSubscription = player.addListener('sourceLoad', ({ duration }) => {
      setVideoDuration(Number.isFinite(duration) ? duration : 0);
      setVideoTime(player.currentTime || 0);
      Reflect.set(player, 'loop', true);
    });

    return () => {
      timeSubscription.remove();
      sourceSubscription.remove();
    };
  }, [player]);

  useEffect(() => {
    Reflect.set(player, 'timeUpdateEventInterval', 0.5);
  }, [player]);

  const lastVideoNameRef = useRef(homeVideoName);
  useEffect(() => {
    if (lastVideoNameRef.current !== homeVideoName) {
      lastVideoNameRef.current = homeVideoName;
      savedHomeVideoTime = 0;
      setVideoTime(0);
      try {
        Reflect.set(player, 'currentTime', 0);
      } catch {}
    }
  }, [homeVideoName, player]);

  useEffect(() => () => clearTimeout(controlsTimer.current), []);

  useFocusEffect(useCallback(() => {
    Reflect.set(player, 'loop', true);
    if (savedHomeVideoTime > 0) {
      const maxTime = Number.isFinite(player.duration) && player.duration > 0
        ? Math.max(0, player.duration - 0.1)
        : savedHomeVideoTime;
      const resumeAt = Math.min(savedHomeVideoTime, maxTime);
      Reflect.set(player, 'currentTime', resumeAt);
      setVideoTime(resumeAt);
    }
    if (playing || isSpeechActive) {
      player.pause();
    } else {
      player.play();
    }
    return () => {
      savedHomeVideoTime = player.currentTime || savedHomeVideoTime;
      player.pause();
    };
  }, [player, playing, isSpeechActive]));

  useEffect(() => {
    if (!isFocused || playing || isSpeechActive) {
      savedHomeVideoTime = player.currentTime || savedHomeVideoTime;
      player.pause();
    } else {
      player.play();
    }
  }, [isFocused, playing, isSpeechActive, player]);

  const handleChangeHomeVideo = async () => {
    try {
      const saved = await changeHomeVideo();
      if (saved) {
        savedHomeVideoTime = 0;
        player.play();
      }
    } catch (err) {
      console.warn('Error changing home video:', err);
    }
  };

  const handleRestoreDefaultVideo = async () => {
    try {
      await resetHomeVideo();
      savedHomeVideoTime = 0;
      player.play();
    } catch (err) {
      console.warn('Error restoring default video:', err);
    }
  };

  const seekVideo = (event) => {
    event.stopPropagation();
    if (!videoDuration || !progressWidth) return;
    const nextTime = Math.max(0, Math.min(event.nativeEvent.locationX / progressWidth, 1)) * videoDuration;
    Reflect.set(player, 'currentTime', nextTime);
    setVideoTime(nextTime);
  };

  const showControls = () => {
    setVideoTime(player.currentTime || 0);
    setVideoDuration(Number.isFinite(player.duration) ? player.duration : 0);
    controlsOpacity.stopAnimation();
    controlsOpacity.setValue(1);
    setControlsVisible(true);
    clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      Animated.timing(controlsOpacity, { toValue: 0, duration: 500, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setControlsVisible(false);
      });
    }, 4000);
  };

  const progress = videoDuration > 0 ? Math.max(0, Math.min(videoTime / videoDuration, 1)) : 0;

  return (
    <View style={styles.videoWrap}>
      <View
        collapsable={false}
        onTouchStart={showControls}
        style={styles.homeVideo}
      >
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          contentFit="cover"
          nativeControls={false}
          surfaceType={Platform.OS === 'android' ? 'textureView' : undefined}
        />
        {controlsVisible ? (
          <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.videoControlsOverlay, { opacity: controlsOpacity }]}>
            <View pointerEvents="box-none" style={styles.videoTopActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Change Home Video"
                onPress={handleChangeHomeVideo}
                style={styles.videoActionButton}
              >
                <Ionicons name="film-outline" size={13} color="#fff" />
                <Text style={styles.videoActionText}>Change Video</Text>
              </Pressable>
              {isCustomHomeVideo ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Restore Default Video"
                  onPress={handleRestoreDefaultVideo}
                  style={styles.videoActionButton}
                >
                  <Ionicons name="refresh-outline" size={13} color="#fff" />
                  <Text style={styles.videoActionText}>Default</Text>
                </Pressable>
              ) : null}
            </View>
            <View pointerEvents="box-none" style={styles.videoControlBar}>
              <View style={styles.videoInfoRow}>
                <Text numberOfLines={1} style={styles.videoTitle}>
                  {isCustomHomeVideo && homeVideoName ? homeVideoName : (currentTrack?.title || 'Mistletoe by Justin Bieber')}
                </Text>
                <Text style={styles.videoTime}>
                  {formatVideoTime(videoTime)} / {formatVideoTime(videoDuration)}
                </Text>
              </View>
              <Pressable
                accessibilityRole="adjustable"
                accessibilityLabel="Video progress"
                accessibilityValue={{ min: 0, max: videoDuration, now: videoTime }}
                onPress={seekVideo}
                onLayout={(event) => setProgressWidth(event.nativeEvent.layout.width)}
                style={styles.videoProgressHitArea}
              >
                <View style={styles.videoProgressTrack}>
                  <View style={[styles.videoProgressFill, { width: `${progress * 100}%` }]} />
                </View>
              </Pressable>
            </View>
          </Animated.View>
        ) : null}
      </View>
      <View pointerEvents="none" style={styles.snowVideoBorder}>
        <Text style={[styles.snowflakeAccent, styles.snowflakeTopLeft]}>❄</Text>
        <Text style={[styles.snowflakeAccent, styles.snowflakeTopRight]}>❄</Text>
        <Text style={[styles.snowflakeAccent, styles.snowflakeBottomLeft]}>❄</Text>
        <Text style={[styles.snowflakeAccent, styles.snowflakeBottomRight]}>❄</Text>
      </View>
      <Animated.View
        pointerEvents="none"
        style={[styles.videoBenjie, { transform: [{ translateY: benjieY }, { rotate: benjieTilt }] }]}
      >
        <Image source={benjieHat} contentFit="contain" style={{ width: '100%', height: '100%' }} />
      </Animated.View>
    </View>
  );
}

function formatVideoTime(time) {
  const totalSeconds = Math.max(0, Math.floor(Number.isFinite(time) ? time : 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function Music() {
  const insets = useSafeAreaInsets();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedLetter, setSelectedLetter] = useState('All');
  const [userAlbums, setUserAlbums] = useState([]);
  const [hiddenAlbumIds, setHiddenAlbumIds] = useState([]);
  const [artistCovers, setArtistCovers] = useState({});
  const { currentTrack, homeVideoPlayer, libraryId, playTrack, playQueue, recentlyPlayed, tracks, playing } = usePlayback();

  useEffect(() => {
    let active = true;
    if (!libraryId) return () => { active = false; };

    Promise.all([
      getUserAlbums(libraryId),
      AsyncStorage.getItem(`music-player.hidden-albums:${libraryId}`),
    ]).then(([albums, hiddenRaw]) => {
      if (!active) return;
      setUserAlbums(albums);
      if (hiddenRaw) {
        try {
          setHiddenAlbumIds(JSON.parse(hiddenRaw));
        } catch {
          setHiddenAlbumIds([]);
        }
      } else {
        setHiddenAlbumIds([]);
      }
    }).catch(() => {});

    return () => { active = false; };
  }, [libraryId]);

  useFocusEffect(useCallback(() => {
    let active = true;
    getArtistCovers(libraryId).then((covers) => {
      if (active) setArtistCovers(covers);
    });
    return () => { active = false; };
  }, [libraryId]));

  const homeAlbums = useMemo(() => {
    const userAlbumItems = userAlbums.map((album) => ({ ...album, isUserAlbum: true }));
    const libraryAlbumItems = buildAlbums(tracks).map((album) => ({
      ...album,
      routeId: album.routeId,
      trackIds: album.tracks.map((track) => track.id),
      artworkUri: null,
      isUserAlbum: false,
    }));
    const hiddenIds = new Set(hiddenAlbumIds);
    return [...userAlbumItems, ...libraryAlbumItems].filter((album) => !hiddenIds.has(album.id));
  }, [hiddenAlbumIds, tracks, userAlbums]);
  const artistCollections = useMemo(() => buildArtistCollections(tracks), [tracks]);

  const recentItems = useMemo(() => recentlyPlayed.map((entry) => {
    if (entry.type === 'track') {
      const track = tracks.find((item) => item.id === entry.id);
      return track ? { key: `track:${track.id}`, title: track.title, subtitle: track.artist, image: track.artwork, track } : null;
    }
    const songCount = entry.trackIds.length;
    return { key: `album:${entry.id}`, title: entry.title, subtitle: `Playlist · ${songCount} song${songCount === 1 ? '' : 's'}`, image: entry.artworkUri ? { uri: entry.artworkUri } : null, album: entry };
  }).filter(Boolean), [recentlyPlayed, tracks]);

  const sortedSongs = useMemo(() => {
    return [...tracks]
      .sort((first, second) => (first.title || '').localeCompare(second.title || '', undefined, { sensitivity: 'base', numeric: true }))
      .map((track) => ({ ...track, image: track.artwork }));
  }, [tracks]);

  const availableLetters = useMemo(() => {
    const set = new Set();
    sortedSongs.forEach((song) => {
      const firstChar = (song.title || '').trim().charAt(0).toUpperCase();
      set.add(/[A-Z]/.test(firstChar) ? firstChar : '#');
    });
    return set;
  }, [sortedSongs]);

  const groupedSections = useMemo(() => {
    const groups = {};
    sortedSongs.forEach((song) => {
      const firstChar = (song.title || '').trim().charAt(0).toUpperCase();
      const letter = /[A-Z]/.test(firstChar) ? firstChar : '#';
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(song);
    });
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === '#') return 1;
      if (b === '#') return -1;
      return a.localeCompare(b);
    });
    return sortedKeys.map((letter) => ({
      letter,
      songs: groups[letter],
    }));
  }, [sortedSongs]);

  const displayedSections = useMemo(() => {
    if (selectedLetter === 'All') return groupedSections;
    return groupedSections.filter((sec) => sec.letter === selectedLetter);
  }, [groupedSections, selectedLetter]);

  return (
    <ImageBackground
      source={christmasBackground}
      contentFit="cover"
      autoplay
      style={styles.background}
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.screen}>
        <View pointerEvents="none" style={[styles.christmasHeaderSpace, { height: Math.max(insets.top + 44, 92) }]} />
        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.contentContainer, { paddingTop: 70, paddingBottom: currentTrack ? 76 : 20 }]}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          
                   <FadeInUp distance={30} duration={600}>
            {Platform.OS !== 'web' ? <HomeVideo key="home-video-player" player={homeVideoPlayer} playing={playing} currentTrack={currentTrack} /> : null}
          </FadeInUp>

          <FadeInUp delay={150}>
            <View style={styles.header}>
              <View>
                <View style={styles.headingTitleRow}>
                  <Text numberOfLines={1} style={styles.name}>What sounds good today?</Text>
                  <Text style={styles.headingSnowflake}>❄</Text>
                </View>
                <Text style={styles.greeting}>Pick a song for the moment.</Text>
              </View>
            </View>
          </FadeInUp>

          <FadeInUp delay={250}>
            <ScrollView
              horizontal
              style={styles.categoryScroll}
              contentContainerStyle={styles.categories}
              showsHorizontalScrollIndicator={false}
            >
              {categories.map((category) => {
                const isSelected = category.label === selectedCategory;
                return (
                  <PressableScale
                    key={category.label}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => {
                      setSelectedCategory(category.label);
                      if (category.label === 'My Albums') router.push('/Albums');
                      if (category.label === 'Podcast') router.push('/podcast');
                    }}
                    style={[styles.categoryBook, category.label === 'All' && styles.categoryBookSongs, isSelected && styles.categoryBookSelected]}
                  >
                    <View style={[styles.categoryBookIconFrame, isSelected && styles.categoryBookIconFrameSelected]}>
                      <Ionicons name={category.icon} size={29} color={COLORS.gold} />
                    </View>
                    <Text style={styles.categoryBookLabel}>
                      {category.label}
                    </Text>
                    {isSelected ? <View style={styles.categoryBookRibbon} /> : null}
                  </PressableScale>
                );
              })}
            </ScrollView>
          </FadeInUp>

          <FadeInUp delay={350}>
            <View style={[styles.sectionHeading, styles.recentHeading]}>
              <View style={styles.headingTitleRow}>
                <Text style={styles.sectionTitle}>Recently Played</Text>
                <Text style={styles.headingSnowflake}>❄</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => router.push('/RecentlyPlayed')} hitSlop={8}>
                <View style={styles.seeAllRow}><Text style={styles.seeAll}>See all</Text><Ionicons name="chevron-forward" size={14} color={COLORS.gold} /></View>
              </Pressable>
            </View>

            {recentItems.length ? (
              <ScrollView horizontal style={styles.recentScroll} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentRow}>
                {recentItems.map((item) => (
                  <PressableScale key={item.key} accessibilityRole="button" accessibilityLabel={`Play recently played ${item.title}`} onPress={() => {
                    if (item.track) {
                      playTrack(item.track);
                      router.push('/Player');
                      return;
                    }
                    const trackIds = item.album.trackIds ?? item.album.tracks?.map((t) => t.id) ?? [];
                    const albumTracks = trackIds.map((id) => tracks.find((track) => track.id === id)).filter((track) => track?.source);
                    if (albumTracks.length) {
                      playQueue(albumTracks, albumTracks[0], { type: 'album', id: item.album.id, title: item.album.title, artworkUri: item.album.artworkUri, trackIds });
                      router.push('/Player');
                    } else {
                      router.push({ pathname: '/Albums', params: { albumId: item.album.id } });
                    }
                  }} style={styles.albumCard}>
                    <SongArtwork source={item.image} style={styles.albumArt} />
                    <Text numberOfLines={1} style={styles.albumTitle}>{item.title}</Text>
                    <Text numberOfLines={1} style={styles.albumSubtitle}>{item.subtitle}</Text>
                  </PressableScale>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.recentEmpty}>
                <Ionicons name="time-outline" size={22} color={COLORS.green} />
                <Text style={styles.recentEmptyText}>Songs and albums you play will show up here.</Text>
              </View>
            )}
          </FadeInUp>

          {artistCollections.length ? (
            <>
              <View style={[styles.sectionHeading, styles.artistCollectionsHeading]}>
                <View style={styles.headingTitleRow}>
                  <Text style={styles.sectionTitle}>Artists</Text>
                  <Text style={styles.headingSnowflake}>❄</Text>
                </View>
              </View>
              <ScrollView
                horizontal
                style={styles.artistCollectionsScroll}
                contentContainerStyle={styles.artistCollectionsRow}
                showsHorizontalScrollIndicator={false}
              >
                {artistCollections.map((collection) => (
                  <Pressable
                    key={collection.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Browse ${collection.artist}, ${collection.tracks.length} songs`}
                    onPress={() => router.push({ pathname: '/Artist', params: { artist: collection.artist } })}
                    style={styles.artistCollectionCard}
                  >
                    <SongArtwork source={artistCovers[collection.id] ? { uri: artistCovers[collection.id] } : collection.artwork} style={styles.artistCollectionArt} iconSize={35} />
                    <Text numberOfLines={1} style={styles.artistCollectionName}>{collection.artist}</Text>
                    <Text style={styles.artistCollectionCount}>{collection.tracks.length} {collection.tracks.length === 1 ? 'song' : 'songs'}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}

          {homeAlbums.length ? (
            <>
              <View style={[styles.sectionHeading, styles.homeAlbumsHeading]}>
                <View style={styles.headingTitleRow}>
                  <Text style={styles.sectionTitle}>Your Albums</Text>
                  <Text style={styles.headingSnowflake}>❄</Text>
                </View>
                <Pressable accessibilityRole="button" onPress={() => router.push('/Albums')} hitSlop={8}>
                  <View style={styles.seeAllRow}><Text style={styles.seeAll}>See all</Text><Ionicons name="chevron-forward" size={14} color={COLORS.gold} /></View>
                </Pressable>
              </View>
              <ScrollView
                horizontal
                style={styles.homeAlbumsScroll}
                contentContainerStyle={styles.homeAlbumsRow}
                showsHorizontalScrollIndicator={false}
              >
                {homeAlbums.map((album) => {
                  const albumTracks = album.tracks ?? album.trackIds?.map((id) => tracks.find((track) => track.id === id)).filter(Boolean) ?? [];
                  const artwork = album.artworkUri ? { uri: album.artworkUri } : album.artwork ?? null;
                  const subtitle = album.isUserAlbum
                    ? `Playlist · ${albumTracks.length} song${albumTracks.length === 1 ? '' : 's'}`
                    : `${album.artist || 'Album'} · ${albumTracks.length} song${albumTracks.length === 1 ? '' : 's'}`;

                  return (
                    <Pressable
                      key={album.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${album.title}, ${subtitle}`}
                      onPress={() => router.push({ pathname: '/Albums', params: { albumId: album.routeId ?? album.id } })}
                      style={styles.homeAlbumCard}
                    >
                      <SongArtwork source={artwork} style={styles.homeAlbumArt} iconSize={42} />
                      <Text numberOfLines={1} style={styles.homeAlbumTitle}>{album.title}</Text>
                      <Text numberOfLines={1} style={styles.homeAlbumSubtitle}>{subtitle}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          ) : null}

          <View style={[styles.sectionHeading, styles.songsHeading]}>
            <View style={styles.headingTitleRow}>
              <Text style={styles.sectionTitle}>Local Songs</Text>
              {sortedSongs.length ? (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{sortedSongs.length}</Text>
                </View>
              ) : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Search your music" onPress={() => router.push('/Search')} hitSlop={8} style={styles.searchLink}>
              <Ionicons name="search" size={14} color={COLORS.gold} />
              <Text style={styles.seeAll}>Search</Text>
            </Pressable>
          </View>

          {sortedSongs.length > 0 ? (
            <View style={styles.alphabetBarWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.alphabetBar}
              >
                {ALPHABET_LETTERS.map((letter) => {
                  const isSelected = letter === selectedLetter;
                  const isAvailable = letter === 'All' || availableLetters.has(letter);
                  return (
                    <Pressable
                      key={letter}
                      accessibilityRole="button"
                      accessibilityLabel={letter === 'All' ? 'Show all songs' : `Filter songs starting with ${letter}`}
                      accessibilityState={{ selected: isSelected, disabled: !isAvailable }}
                      disabled={!isAvailable}
                      onPress={() => setSelectedLetter(letter)}
                      style={[
                        styles.letterPill,
                        isSelected && styles.letterPillSelected,
                        !isAvailable && styles.letterPillDisabled,
                      ]}
                    >
                      <Text
                        style={[
                          styles.letterText,
                          isSelected && styles.letterTextSelected,
                          !isAvailable && styles.letterTextDisabled,
                        ]}
                      >
                        {letter}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          <View style={styles.songList}>
            {displayedSections.map((section) => (
              <View key={section.letter} style={styles.sectionBlock}>
                <View style={styles.letterHeader}>
                  <View style={styles.letterBadge}>
                    <Text style={styles.letterBadgeText}>{section.letter}</Text>
                  </View>
                  <View style={styles.letterLine} />
                  <Text style={styles.letterCount}>
                    {section.songs.length} {section.songs.length === 1 ? 'song' : 'songs'}
                  </Text>
                </View>
                <View style={styles.sectionSongs}>
                  {section.songs.map((song) => (
                    <Pressable
                      key={song.id || `${section.letter}-${song.title}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Play ${song.title} by ${song.artist || 'Unknown artist'}`}
                      onPress={() => {
                        playTrack(song);
                        router.push('/Player');
                      }}
                      style={styles.songRow}
                    >
                      <SongArtwork source={song.image} style={styles.songArt} iconSize={20} />
                      <View style={styles.songDetails}>
                        <Text numberOfLines={1} style={styles.songTitle}>{song.title}</Text>
                        <Text numberOfLines={1} style={styles.songArtist}>{song.artist || 'Unknown artist'}</Text>
                      </View>
                      <View style={styles.playButton}>
                        <Ionicons name="play" size={14} color={COLORS.green} />
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
            {!sortedSongs.length ? (
              <View style={styles.emptySongs}>
                <Ionicons name="musical-notes-outline" size={26} color={COLORS.green} />
                <Text style={styles.emptySongsTitle}>No songs yet</Text>
                <Text style={styles.emptySongsMessage}>Choose your music folder in Settings, then rescan it.</Text>
                <Pressable accessibilityRole="button" onPress={() => router.push('/Settings')} style={styles.emptySongsButton}>
                  <Text style={styles.emptySongsButtonText}>Open Settings</Text>
                </Pressable>
              </View>
            ) : selectedLetter !== 'All' && !displayedSections.length ? (
              <View style={styles.emptyFilter}>
                <Ionicons name="filter-outline" size={22} color={COLORS.green} />
                <Text style={styles.emptyFilterText}>{`No songs starting with "${selectedLetter}"`}</Text>
                <Pressable accessibilityRole="button" onPress={() => setSelectedLetter('All')} style={styles.clearFilterButton}>
                  <Text style={styles.clearFilterText}>Show all songs</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          {[
            { label: 'Home', icon: 'home' },
            { label: 'Search', icon: 'search' },
            { label: 'Your Library', icon: 'library' },
            { label: 'Settings', icon: 'settings' },
          ].map((tab) => {
            const isSelected = tab.label === 'Home';
            return (
              <Pressable
                key={tab.label}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => {
                  if (tab.label === 'Home') router.replace('/Music');
                  if (tab.label === 'Search') router.push('/Search');
                  if (tab.label === 'Your Library') router.push('/Library');
                  if (tab.label === 'Settings') router.push('/Settings');
                }}
                style={styles.tab}
              >
                <Ionicons
                  name={isSelected ? tab.icon : `${tab.icon}-outline`}
                  size={23}
                  color={isSelected ? COLORS.cream : COLORS.gold}
                />
                <Text style={[styles.tabLabel, isSelected && styles.tabLabelSelected]}>
                  {tab.label}
                </Text>
                <View style={[styles.tabIndicator, isSelected && styles.tabIndicatorActive]} />
              </Pressable>
            );
          })}
        </View>
      </View>
    </ImageBackground>
  );
}

const COLORS = {
  green: '#164d38',
  red: '#930d1c',
  gold: '#f4c86a',
  ink: '#fff3d5',
  muted: '#e2d2ad',
  cream: '#fff8e9',
};

const styles = StyleSheet.create({
  background: { flex: 1, width: '100%' },
  screen: { flex: 1, backgroundColor: 'transparent' },
  christmasHeaderSpace: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1 },
  content: { flex: 1, minHeight: 0 },
  contentContainer: { paddingHorizontal: 20 },
    videoWrap: { position: 'relative', height: 288, marginBottom: 36, overflow: 'visible', transform: [{ translateY: 20 }] },
    homeVideo: {
      position: 'absolute',
      top: 120,
      left: 0,
      right: 0,
      width: '100%',
      height: 168,
      borderRadius: 16,
      borderWidth: 3,
      borderColor: COLORS.gold,
      overflow: 'hidden',
      backgroundColor: '#164d38',
    },
  snowVideoBorder: { position: 'absolute', top: 120, left: 0, right: 0, height: 168, zIndex: 60, borderRadius: 16 },
  snowflakeAccent: { position: 'absolute', color: COLORS.cream, fontSize: 13, lineHeight: 16, textShadowColor: COLORS.gold, textShadowRadius: 5 },
  snowflakeTopLeft: { top: -7, left: 7 },
  snowflakeTopRight: { top: -7, right: 7 },
  snowflakeBottomLeft: { bottom: -7, left: 7 },
  snowflakeBottomRight: { bottom: -7, right: 7 },
  videoBenjie: { position: 'absolute', zIndex: 0, elevation: 9, top: -83, alignSelf: 'center', width: 274, height: 270 },
  videoControlsOverlay: { zIndex: 40 },
  videoTopActions: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', gap: 6, zIndex: 50 },
  videoActionButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.65)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  videoActionText: { color: '#fff', fontFamily: 'NunitoBold', fontSize: 10 },
  videoControlBar: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 43, justifyContent: 'flex-end', paddingHorizontal: 11, paddingTop: 5, paddingBottom: 0, backgroundColor: 'transparent' },
  videoInfoRow: { minHeight: 21, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, transform: [{ translateY: 3 }] },
  videoTitle: { flex: 1, color: '#fff', fontFamily: 'NunitoBold', fontSize: 13},
  videoTime: { color: '#fff', fontFamily: 'NunitoBold', fontSize: 11, fontVariant: ['tabular-nums'] },
  videoProgressHitArea: { height: 17, justifyContent: 'flex-end', paddingBottom: 0, marginHorizontal: -11 },
  videoProgressTrack: { height: 4, overflow: 'visible', borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.5)' },
  videoProgressFill: { height: '100%', borderRadius: 2, backgroundColor: '#ff1744' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  name: { flexShrink: 1, color: COLORS.cream, fontFamily: 'NunitoExtraBold', fontSize: 24, lineHeight: 30, textShadowColor: 'rgba(0,0,0,0.65)', textShadowRadius: 6 },
  greeting: { color: COLORS.cream, fontFamily: 'NunitoSemiBold', fontSize: 15, textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 5 },
  categoryScroll: { height: 116, flexGrow: 0, flexShrink: 0, marginBottom: 14 },
  categories: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 2, paddingVertical: 5, paddingRight: 6 },
  categoryBook: {
    width: 96,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    padding: 7,
    borderRadius: 13,
    backgroundColor: '#8e1420',
    borderWidth: 2,
    borderColor: COLORS.gold,
    shadowColor: COLORS.gold,
    shadowOpacity: 0.28,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  categoryBookSongs: { backgroundColor: COLORS.green },
  categoryBookSelected: { backgroundColor: COLORS.green, borderColor: '#ffe49a', shadowOpacity: 0.72, shadowRadius: 11, elevation: 5, transform: [{ translateY: -3 }] },
  categoryBookIconFrame: { width: 50, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(244,200,106,0.72)', backgroundColor: 'rgba(23,6,5,0.22)' },
  categoryBookIconFrameSelected: { borderColor: '#ffe7a3', backgroundColor: 'rgba(0,25,15,0.4)' },
  categoryBookLabel: { color: COLORS.cream, fontFamily: 'NunitoExtraBold', fontSize: 12, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3 },
  categoryBookRibbon: { position: 'absolute', bottom: -10, width: 16, height: 17, backgroundColor: COLORS.red, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 11,
  },
  recentHeading: { marginBottom: 6 },
  homeAlbumsHeading: { marginTop: 14, marginBottom: 9 },
  artistCollectionsHeading: { marginTop: 14, marginBottom: 9 },
  artistCollectionsScroll: { flexGrow: 0, flexShrink: 0 },
  artistCollectionsRow: { flexDirection: 'row', gap: 13, paddingBottom: 2 },
  artistCollectionCard: { width: 136 },
  artistCollectionArt: { width: 136, height: 136, borderRadius: 14, borderWidth: 2, borderColor: COLORS.gold, backgroundColor: '#123a2a' },
  artistCollectionName: { color: COLORS.cream, fontFamily: 'NunitoExtraBold', fontSize: 14, marginTop: 6 },
  artistCollectionCount: { color: COLORS.gold, fontFamily: 'NunitoSemiBold', fontSize: 12, marginTop: 1 },
  homeAlbumsScroll: { flexGrow: 0, flexShrink: 0 },
  homeAlbumsRow: { flexDirection: 'row', gap: 14, paddingBottom: 2 },
  homeAlbumCard: { width: 166 },
  homeAlbumArt: { width: 166, height: 166, borderRadius: 14, borderWidth: 2, borderColor: COLORS.gold, backgroundColor: '#123a2a' },
  homeAlbumTitle: { color: COLORS.cream, fontFamily: 'NunitoExtraBold', fontSize: 14, marginTop: 7 },
  homeAlbumSubtitle: { color: COLORS.gold, fontFamily: 'NunitoSemiBold', fontSize: 12, marginTop: 1 },
  sectionTitle: { color: COLORS.cream, fontFamily: 'NunitoExtraBold', fontSize: 19, textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 5 },
  headingSnowflake: { color: COLORS.gold, fontSize: 17, textShadowColor: COLORS.gold, textShadowRadius: 7 },
  seeAllRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAll: { color: COLORS.gold, fontFamily: 'NunitoExtraBold', fontSize: 13, textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 4 },
  recentScroll: { height: 151, flexGrow: 0, flexShrink: 0 },
  recentRow: { flexDirection: 'row', gap: 11 },
  albumCard: { width: 104 },
  albumArt: { width: '100%', aspectRatio: 1, borderRadius: 12, borderWidth: 2, borderColor: COLORS.gold, backgroundColor: '#123a2a' },
  albumTitle: { color: COLORS.cream, fontFamily: 'NunitoExtraBold', fontSize: 13, marginTop: 6, textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 4 },
  albumSubtitle: { color: COLORS.gold, fontFamily: 'NunitoSemiBold', fontSize: 12 },
  recentEmpty: { minHeight: 55, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.gold, backgroundColor: 'rgba(5,35,24,0.78)' },
  recentEmptyText: { color: COLORS.cream, fontFamily: 'NunitoSemiBold', fontSize: 12, flexShrink: 1 },
  songsHeading: { marginTop: 12, marginBottom: 8 },
  headingTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countBadge: {
    backgroundColor: 'rgba(5, 35, 24, 0.72)',
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  countBadgeText: { color: COLORS.gold, fontFamily: 'NunitoBold', fontSize: 11 },
  searchLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  alphabetBarWrapper: { marginBottom: 10 },
  alphabetBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  letterPill: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5, 35, 24, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(244, 200, 106, 0.6)',
  },
  letterPillSelected: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.gold,
  },
  letterPillDisabled: {
    opacity: 0.32,
    backgroundColor: 'transparent',
  },
  letterText: { color: COLORS.ink, fontFamily: 'NunitoBold', fontSize: 12 },
  letterTextSelected: { color: COLORS.cream, fontFamily: 'NunitoExtraBold' },
  letterTextDisabled: { color: COLORS.muted },
  sectionBlock: { marginBottom: 14 },
  letterHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, marginTop: 4 },
  letterBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center' },
  letterBadgeText: { color: COLORS.cream, fontFamily: 'NunitoExtraBold', fontSize: 11 },
  letterLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(244, 200, 106, 0.55)' },
  letterCount: { color: COLORS.muted, fontFamily: 'NunitoSemiBold', fontSize: 11 },
  sectionSongs: { gap: 8 },
  emptyFilter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
    backgroundColor: 'rgba(5, 35, 24, 0.82)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  emptyFilterText: { color: COLORS.ink, fontFamily: 'NunitoBold', fontSize: 13 },
  clearFilterButton: {
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: COLORS.green,
  },
  clearFilterText: { color: COLORS.cream, fontFamily: 'NunitoBold', fontSize: 11 },
  songList: { gap: 8 },
  emptySongs: { alignItems: 'center', paddingHorizontal: 18, paddingVertical: 24, borderRadius: 14, borderWidth: 1, borderColor: COLORS.gold, backgroundColor: 'rgba(5,35,24,0.84)' },
  emptySongsTitle: { color: COLORS.ink, fontFamily: 'NunitoExtraBold', fontSize: 14, marginTop: 8, textAlign: 'center' },
  emptySongsMessage: { color: COLORS.muted, fontFamily: 'NunitoRegular', fontSize: 12, lineHeight: 17, marginTop: 4, textAlign: 'center' },
  emptySongsButton: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 16, marginTop: 12, borderRadius: 18, backgroundColor: COLORS.green },
  emptySongsButtonText: { color: COLORS.cream, fontFamily: 'NunitoBold', fontSize: 12 },
  songRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10 },
  songArt: { width: 44, height: 44, borderRadius: 8, borderWidth: 1.5, borderColor: COLORS.gold, backgroundColor: '#123a2a' },
  songDetails: { flex: 1, minWidth: 0 },
  songTitle: { color: COLORS.ink, fontFamily: 'NunitoBold', fontSize: 12 },
  songArtist: { color: COLORS.gold, fontFamily: 'NunitoRegular', fontSize: 11 },
  playButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244, 200, 106, 0.16)',
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  bottomBar: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 9,
    borderTopWidth: 1.5,
    borderTopColor: COLORS.gold,
    backgroundColor: COLORS.red,
  },
  tab: { flex: 1, minWidth: 0, alignItems: 'center', gap: 2 },
  tabIndicator: { width: 42, height: 3, marginTop: 2, borderRadius: 2, backgroundColor: 'transparent' },
  tabIndicatorActive: { backgroundColor: COLORS.gold, shadowColor: COLORS.gold, shadowOpacity: 0.8, shadowRadius: 6, elevation: 3 },
  tabLabel: { color: COLORS.gold, fontFamily: 'NunitoSemiBold', fontSize: 11 },
  tabLabelSelected: { color: COLORS.cream, fontFamily: 'NunitoExtraBold', textShadowColor: COLORS.gold, textShadowRadius: 5 },
});
