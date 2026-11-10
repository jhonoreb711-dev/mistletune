import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, PanResponder, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ImageBackground } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import christmasBackground from '../assets/christmas_bg4.png';
import { usePlayback } from './PlaybackContext';
import SongArtwork from './SongArtwork';
import { deleteUserAlbum, getUserAlbums, pickAlbumCover, saveUserAlbum } from './userAlbums';
import { useFavorites } from './FavoritesContext';
import { buildAlbums } from './albumLibrary';

function shuffleTracks(tracks) {
  const shuffled = [...tracks];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export default function CollectionScreen() {
  const { albumId, requestId } = useLocalSearchParams();
  const initialAlbumId = typeof albumId === 'string' ? albumId : null;
  return <CollectionContent key={JSON.stringify([initialAlbumId, requestId])} initialAlbumId={initialAlbumId} />;
}

function CollectionContent({ initialAlbumId }) {
  const insets = useSafeAreaInsets();
  const [selectedAlbumId, setSelectedAlbumId] = useState(initialAlbumId);
  const [userAlbums, setUserAlbums] = useState([]);
  const [isDraggingTrack, setIsDraggingTrack] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingAlbumId, setEditingAlbumId] = useState(null);
  const [albumTitle, setAlbumTitle] = useState('');
  const [selectedTrackIds, setSelectedTrackIds] = useState([]);
  const [coverUri, setCoverUri] = useState(null);
  const [formMessage, setFormMessage] = useState('');
  const [hiddenAlbumIds, setHiddenAlbumIds] = useState([]);
  const { currentTrack, libraryId, tracks, playQueue } = usePlayback();
  const { isAlbumFavorite, toggleAlbumFavorite } = useFavorites();
  const scrollBottomPadding = Math.max(insets.bottom, 16) + (currentTrack ? 156 : 84);

  useEffect(() => {
    let isMounted = true;
    if (libraryId) {
      AsyncStorage.getItem(`music-player.hidden-albums:${libraryId}`)
        .then((raw) => {
          if (isMounted && raw) {
            try {
              setHiddenAlbumIds(JSON.parse(raw));
            } catch {}
          }
        })
        .catch(() => {});
    }
    return () => { isMounted = false; };
  }, [libraryId]);

  const libraryAlbums = useMemo(() => buildAlbums(tracks).map((album) => ({
    id: album.id,
    routeId: album.routeId,
    title: album.title,
    artist: album.artist,
    artwork: album.artwork,
    artworkUri: null,
    tracks: album.tracks,
    trackIds: album.tracks.map((track) => track.id),
    isUserAlbum: false,
  })), [tracks]);

  const userAlbumsList = useMemo(() => userAlbums.map((album) => ({
    ...album,
    isUserAlbum: true,
  })), [userAlbums]);

  const allAlbums = useMemo(() => {
    const combined = [...userAlbumsList, ...libraryAlbums];
    if (!hiddenAlbumIds.length) return combined;
    const hiddenSet = new Set(hiddenAlbumIds);
    return combined.filter((album) => !hiddenSet.has(album.id));
  }, [userAlbumsList, libraryAlbums, hiddenAlbumIds]);

  const selectedAlbum = allAlbums.find((album) => album.id === selectedAlbumId || album.routeId === selectedAlbumId);
  const selectedAlbumTracks = useMemo(() => {
    if (!selectedAlbum) return [];
    if (Array.isArray(selectedAlbum.tracks) && selectedAlbum.tracks.length > 0) {
      return selectedAlbum.tracks;
    }
    if (Array.isArray(selectedAlbum.trackIds)) {
      return selectedAlbum.trackIds.map((id) => tracks.find((track) => track.id === id)).filter(Boolean);
    }
    return [];
  }, [selectedAlbum, tracks]);

  const dropAlbumTrack = useCallback(async (trackId, fromIndex, toIndex) => {
    if (!selectedAlbum || !selectedAlbum.isUserAlbum || fromIndex === toIndex) return;
    const orderedTracks = [...selectedAlbumTracks];
    const [movedTrack] = orderedTracks.splice(fromIndex, 1);
    if (!movedTrack) return;
    orderedTracks.splice(toIndex, 0, movedTrack);
    const visibleTrackIds = new Set(selectedAlbumTracks.map((track) => track.id));
    const updatedAlbum = {
      ...selectedAlbum,
      trackIds: [
        ...orderedTracks.map((track) => track.id),
        ...selectedAlbum.trackIds.filter((id) => !visibleTrackIds.has(id)),
      ],
    };
    setUserAlbums((current) => current.map((album) => album.id === updatedAlbum.id ? updatedAlbum : album));
    try {
      await saveUserAlbum(libraryId, updatedAlbum);
    } catch {
      setUserAlbums((current) => current.map((album) => album.id === selectedAlbum.id ? selectedAlbum : album));
      Alert.alert('Could not save song order', 'Please try dragging the song again.');
    }
  }, [libraryId, selectedAlbum, selectedAlbumTracks]);

  const shuffleAlbum = () => {
    const shuffledTracks = shuffleTracks(selectedAlbumTracks);
    if (shuffledTracks.length) {
      playQueue(shuffledTracks, shuffledTracks[0], {
        type: 'album',
        id: selectedAlbum.id,
        title: selectedAlbum.title,
        artworkUri: selectedAlbum.artworkUri,
        trackIds: selectedAlbumTracks.map((track) => track.id),
      });
      router.push('/Player');
    }
  };

  useEffect(() => {
    let isMounted = true;
    getUserAlbums(libraryId).then((savedAlbums) => {
      if (isMounted) setUserAlbums(savedAlbums);
    });
    return () => { isMounted = false; };
  }, [libraryId]);

  const createAlbum = async () => {
    const title = albumTitle.trim();
    if (!title) {
      setFormMessage('Enter an album name.');
      return;
    }
    if (!selectedTrackIds.length) {
      setFormMessage('Select at least one song for this album.');
      return;
    }

    const selectedTracks = selectedTrackIds
      .map((id) => tracks.find((track) => track.id === id))
      .filter(Boolean);
    const album = {
      id: editingAlbumId ?? `user-album-${Date.now()}`,
      title,
      trackIds: selectedTracks.map((track) => track.id),
      artworkUri: coverUri,
    };

    try {
      const updatedAlbums = await saveUserAlbum(libraryId, album);
      setUserAlbums(updatedAlbums);
      setSelectedAlbumId(album.id);
      setIsCreating(false);
      setAlbumTitle('');
      setSelectedTrackIds([]);
      setCoverUri(null);
      setEditingAlbumId(null);
      setFormMessage('');
    } catch {
      setFormMessage('Could not save this album. Please try again.');
    }
  };

  const editAlbum = (album) => {
    setAlbumTitle(album.title);
    setSelectedTrackIds(album.trackIds || []);
    setCoverUri(album.artworkUri);
    setEditingAlbumId(album.id);
    setSelectedAlbumId(null);
    setFormMessage('');
    setIsCreating(true);
  };

  const confirmDeleteAlbum = () => {
    if (!selectedAlbum) return;
    const isUser = Boolean(selectedAlbum.isUserAlbum);
    Alert.alert(
      isUser ? 'Delete album playlist?' : 'Remove album?',
      `“${selectedAlbum.title}” will be removed from Your Albums. Your songs will stay in your music library.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (isUser) {
                const updatedAlbums = await deleteUserAlbum(libraryId, selectedAlbum.id);
                setUserAlbums(updatedAlbums);
              } else {
                const nextHidden = [...hiddenAlbumIds, selectedAlbum.id];
                setHiddenAlbumIds(nextHidden);
                if (libraryId) {
                  await AsyncStorage.setItem(
                    `music-player.hidden-albums:${libraryId}`,
                    JSON.stringify(nextHidden)
                  ).catch(() => {});
                }
              }
              if (isAlbumFavorite(selectedAlbum.id)) await toggleAlbumFavorite(selectedAlbum.id);
              setSelectedAlbumId(null);
            } catch {
              Alert.alert('Could not delete album', 'Please try again.');
            }
          },
        },
      ]
    );
  };

  return (
    <ImageBackground source={christmasBackground} contentFit="cover" style={styles.background}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: insets.top + 42 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={selectedAlbum || isCreating ? 'Back to your albums' : 'Back to music home'}
            onPress={() => {
              if (selectedAlbum) setSelectedAlbumId(null);
              else if (isCreating) { setIsCreating(false); setEditingAlbumId(null); setFormMessage(''); }
              else router.back();
            }}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={25} color={COLORS.ink} />
          </Pressable>
          <Text numberOfLines={1} style={styles.heading}>{selectedAlbum?.title ?? (isCreating ? 'New album playlist' : 'Your Albums')}</Text>
          {selectedAlbum?.isUserAlbum ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Edit album playlist" onPress={() => editAlbum(selectedAlbum)} style={styles.headerAction}>
              <Ionicons name="create-outline" size={21} color={COLORS.cream} />
            </Pressable>
          ) : !selectedAlbum && !isCreating ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create album playlist"
              onPress={() => setIsCreating(true)}
              style={styles.headerAction}
            >
              <Ionicons name="add" size={24} color={COLORS.cream} />
            </Pressable>
          ) : null}
        </View>

        {isCreating ? (
          <ScrollView
            contentContainerStyle={[styles.createForm, { paddingBottom: scrollBottomPadding }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Pressable accessibilityRole="button" onPress={async () => {
              try {
                const selectedCoverUri = await pickAlbumCover(libraryId);
                if (selectedCoverUri) setCoverUri(selectedCoverUri);
              } catch {
                setFormMessage('Could not open the image picker.');
              }
            }} style={styles.coverPicker}>
              <SongArtwork source={coverUri ? { uri: coverUri } : null} style={styles.createCover} iconSize={42} />
              <View style={styles.coverPickerText}>
                <Text style={styles.formLabel}>{coverUri ? 'Change album cover' : 'Upload album cover'}</Text>
                <Text style={styles.formHint}>Choose an image from your device</Text>
              </View>
              <Ionicons name="image-outline" size={21} color={COLORS.green} />
            </Pressable>

            <Text style={styles.formLabel}>Album name</Text>
            <TextInput value={albumTitle} onChangeText={setAlbumTitle} placeholder="Give your album a name" placeholderTextColor={COLORS.muted} style={styles.textInput} />
            <View style={styles.songPickerHeading}>
              <Text style={styles.formLabel}>Choose songs</Text>
              <Text style={styles.formHint}>{selectedTrackIds.length} selected</Text>
            </View>
            {tracks.map((track) => {
              const selected = selectedTrackIds.includes(track.id);
              return (
                <Pressable
                  key={track.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  onPress={() => setSelectedTrackIds((current) => selected
                    ? current.filter((id) => id !== track.id)
                    : [...current, track.id])}
                  style={styles.selectTrackRow}
                >
                  <SongArtwork source={track.artwork} style={styles.trackArt} iconSize={18} />
                  <View style={styles.details}>
                    <Text numberOfLines={1} style={styles.title}>{track.title}</Text>
                    <Text numberOfLines={1} style={styles.artist}>{track.artist}</Text>
                  </View>
                  <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={22} color={selected ? COLORS.green : COLORS.muted} />
                </Pressable>
              );
            })}
            {formMessage ? <Text accessibilityRole="alert" style={styles.formMessage}>{formMessage}</Text> : null}
            <Pressable accessibilityRole="button" onPress={createAlbum} style={styles.saveAlbumButton}>
              <Text style={styles.saveAlbumLabel}>{editingAlbumId ? 'Save changes' : 'Create album playlist'}</Text>
            </Pressable>
          </ScrollView>
        ) : selectedAlbum ? (
          <ScrollView
            style={styles.detailScroll}
            contentContainerStyle={[styles.detailContent, { paddingBottom: scrollBottomPadding }]}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!isDraggingTrack}
          >
            <SongArtwork source={selectedAlbum.artworkUri ? { uri: selectedAlbum.artworkUri } : selectedAlbum.artwork ?? null} style={styles.detailCover} iconSize={76} />
            <Text numberOfLines={2} style={styles.detailTitle}>{selectedAlbum.title}</Text>
            <Text style={styles.albumMeta}>{selectedAlbum.isUserAlbum ? 'Playlist' : (selectedAlbum.artist || 'Album')} · {albumDetails(selectedAlbumTracks)}</Text>

            <View style={styles.albumActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isAlbumFavorite(selectedAlbum.id) ? 'Remove album from favorites' : 'Add album to favorites'}
                onPress={() => toggleAlbumFavorite(selectedAlbum.id)}
                style={styles.likeButton}
              >
                <Ionicons name={isAlbumFavorite(selectedAlbum.id) ? 'heart' : 'heart-outline'} size={27} color={isAlbumFavorite(selectedAlbum.id) ? COLORS.red : COLORS.muted} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Shuffle ${selectedAlbum.title}`} onPress={shuffleAlbum} style={styles.shuffleButton}>
                <Ionicons name="shuffle" size={25} color={COLORS.green} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={selectedAlbum.isUserAlbum ? `Delete ${selectedAlbum.title}` : `Remove ${selectedAlbum.title}`}
                onPress={confirmDeleteAlbum}
                style={styles.deleteActionButton}
              >
                <Ionicons name="trash-outline" size={24} color={COLORS.red} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Play ${selectedAlbum.title}`}
                disabled={!selectedAlbumTracks.length}
                onPress={() => {
                  if (selectedAlbumTracks[0]) {
                    playQueue(selectedAlbumTracks, selectedAlbumTracks[0], {
                      type: 'album',
                      id: selectedAlbum.id,
                      title: selectedAlbum.title,
                      artworkUri: selectedAlbum.artworkUri,
                      trackIds: selectedAlbumTracks.map((track) => track.id),
                    });
                    router.push('/Player');
                  }
                }}
                style={styles.albumPlayButton}
              >
                <Ionicons name="play" size={30} color={COLORS.cream} />
              </Pressable>
            </View>

            <SortableTrackList
              tracks={selectedAlbumTracks}
              isReorderable={Boolean(selectedAlbum.isUserAlbum) && selectedAlbumTracks.length > 1}
              onPlayTrack={(track) => {
                playQueue(selectedAlbumTracks, track, {
                  type: 'album',
                  id: selectedAlbum.id,
                  title: selectedAlbum.title,
                  artworkUri: selectedAlbum.artworkUri,
                  trackIds: selectedAlbumTracks.map((t) => t.id),
                });
                router.push('/Player');
              }}
              onReorder={dropAlbumTrack}
              onDragStateChange={setIsDraggingTrack}
            />
            <Pressable accessibilityRole="button" onPress={confirmDeleteAlbum} style={styles.deleteAlbumButton}>
              <Ionicons name="trash-outline" size={18} color={COLORS.red} />
              <Text style={styles.deleteAlbumLabel}>
                {selectedAlbum.isUserAlbum ? 'Delete album playlist' : 'Remove album from list'}
              </Text>
            </Pressable>
          </ScrollView>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.list, { paddingBottom: scrollBottomPadding }]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.explainer}>Browse albums from your music library or create custom album playlists.</Text>
            {allAlbums.length ? allAlbums.map((album) => {
              const albumTracks = album.tracks ?? (album.trackIds ? album.trackIds.map((id) => tracks.find((track) => track.id === id)).filter(Boolean) : []);
              const artSource = album.artworkUri ? { uri: album.artworkUri } : album.artwork ?? null;
              const metaLabel = album.isUserAlbum
                ? `Playlist · ${albumDetails(albumTracks)}`
                : `${album.artist || 'Album'} · ${albumDetails(albumTracks)}`;
              return (
                <Pressable
                  key={album.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${album.title}, ${metaLabel}`}
                  onPress={() => setSelectedAlbumId(album.id)}
                  style={styles.albumRow}
                >
                  <SongArtwork source={artSource} style={styles.art} iconSize={25} />
                  <View style={styles.details}>
                    <Text numberOfLines={1} style={styles.title}>{album.title}</Text>
                    <Text style={styles.meta}>{metaLabel}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={19} color={COLORS.green} />
                </Pressable>
              );
            }) : null}
            {!allAlbums.length ? <Text style={styles.emptyMessage}>No albums found. Add songs in Settings or tap + to create an album playlist.</Text> : null}
          </ScrollView>
        )}

        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <NavItem label="Home" icon="home" route="/Music" />
          <NavItem label="Search" icon="search" route="/Search" />
          <NavItem label="Your Library" icon="library" route="/Library" selected={Boolean(selectedAlbum)} />
          <NavItem label="Settings" icon="settings" route="/Settings" />
        </View>
      </View>
    </ImageBackground>
  );
}

function NavItem({ label, icon, route, selected = false }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => router.replace(route)} style={styles.navItem}>
      <Ionicons name={selected ? icon : `${icon}-outline`} size={21} color={selected ? COLORS.red : COLORS.muted} />
      <Text style={[styles.navLabel, selected && styles.selectedNavLabel]}>{label}</Text>
    </Pressable>
  );
}

function albumDetails(tracks) {
  const count = tracks?.length ?? 0;
  return `${count} song${count === 1 ? '' : 's'}`;
}

const COLORS = { green: '#174d38', red: '#a62224', ink: '#28251f', muted: '#817764', cream: '#fff8e9' };
const TRACK_ROW_HEIGHT = 66;

function SortableTrackList({
  tracks,
  isReorderable,
  onPlayTrack,
  onReorder,
  onDragStateChange,
}) {
  const [activeId, setActiveId] = useState(null);
  const [activeTranslateY] = useState(() => new Animated.Value(0));
  const [activeScale] = useState(() => new Animated.Value(1));

  const animMap = useMemo(() => {
    const map = {};
    for (const track of tracks) {
      map[track.id] = new Animated.Value(0);
    }
    return map;
  }, [tracks]);

  const gestureStateRef = useRef({
    activeIndex: -1,
    hoverIndex: -1,
    trackId: null,
    isDropping: false,
  });

  const updateOtherItems = useCallback((currActiveIdx, currHoverIdx) => {
    tracks.forEach((track, idx) => {
      if (idx === currActiveIdx) return;
      let targetY = 0;
      if (currHoverIdx > currActiveIdx) {
        if (idx > currActiveIdx && idx <= currHoverIdx) {
          targetY = -TRACK_ROW_HEIGHT;
        }
      } else if (currHoverIdx < currActiveIdx) {
        if (idx >= currHoverIdx && idx < currActiveIdx) {
          targetY = TRACK_ROW_HEIGHT;
        }
      }
      const anim = animMap[track.id];
      if (anim) {
        Animated.spring(anim, {
          toValue: targetY,
          useNativeDriver: true,
          speed: 26,
          bounciness: 2,
        }).start();
      }
    });
  }, [animMap, tracks]);

  const startDrag = useCallback((index, trackId) => {
    const state = gestureStateRef.current;
    if (state.isDropping) return;
    state.activeIndex = index;
    state.hoverIndex = index;
    state.trackId = trackId;
    onDragStateChange?.(true);
    setActiveId(trackId);
    activeTranslateY.setValue(0);
    Animated.spring(activeScale, {
      toValue: 1.03,
      useNativeDriver: true,
      speed: 28,
      bounciness: 4,
    }).start();
  }, [activeScale, activeTranslateY, onDragStateChange]);

  const onDragMove = useCallback((dy) => {
    const state = gestureStateRef.current;
    if (state.isDropping || state.activeIndex < 0) return;
    const minDy = -state.activeIndex * TRACK_ROW_HEIGHT;
    const maxDy = (tracks.length - 1 - state.activeIndex) * TRACK_ROW_HEIGHT;
    const clampedDy = Math.max(minDy, Math.min(maxDy, dy));
    activeTranslateY.setValue(clampedDy);
    const rawStep = Math.round(clampedDy / TRACK_ROW_HEIGHT);
    const targetHover = Math.max(0, Math.min(state.activeIndex + rawStep, tracks.length - 1));
    if (targetHover !== state.hoverIndex) {
      state.hoverIndex = targetHover;
      updateOtherItems(state.activeIndex, targetHover);
    }
  }, [activeTranslateY, tracks.length, updateOtherItems]);

  const onDragEnd = useCallback(() => {
    const state = gestureStateRef.current;
    const currActive = state.activeIndex;
    const currHover = state.hoverIndex;
    const currId = state.trackId;
    if (currActive < 0 || !currId || state.isDropping) return;

    state.isDropping = true;
    const targetY = (currHover - currActive) * TRACK_ROW_HEIGHT;

    Animated.parallel([
      Animated.spring(activeTranslateY, {
        toValue: targetY,
        useNativeDriver: true,
        speed: 28,
        bounciness: 0,
      }),
      Animated.timing(activeScale, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (currHover !== currActive && currActive >= 0 && currHover >= 0) {
        onReorder(currId, currActive, currHover);
      }
      tracks.forEach((track) => {
        animMap[track.id]?.setValue(0);
      });
      activeTranslateY.setValue(0);
      setActiveId(null);
      state.activeIndex = -1;
      state.hoverIndex = -1;
      state.trackId = null;
      state.isDropping = false;
      onDragStateChange?.(false);
    });
  }, [activeScale, activeTranslateY, animMap, onDragStateChange, onReorder, tracks]);

  const onDragCancel = useCallback(() => {
    const state = gestureStateRef.current;
    if (state.isDropping || state.activeIndex < 0) return;
    state.isDropping = true;
    Animated.parallel([
      Animated.spring(activeTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        speed: 26,
        bounciness: 0,
      }),
      Animated.timing(activeScale, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(() => {
      tracks.forEach((track) => {
        animMap[track.id]?.setValue(0);
      });
      activeTranslateY.setValue(0);
      setActiveId(null);
      state.activeIndex = -1;
      state.hoverIndex = -1;
      state.trackId = null;
      state.isDropping = false;
      onDragStateChange?.(false);
    });
  }, [activeScale, activeTranslateY, animMap, onDragStateChange, tracks]);

  if (!tracks.length) {
    return (
      <View style={styles.emptyTrackList}>
        <Ionicons name="musical-notes-outline" size={28} color={COLORS.muted} />
        <Text style={styles.emptyTrackText}>No songs in this album.</Text>
      </View>
    );
  }

  return (
    <View style={styles.trackList}>
      {tracks.map((track, index) => {
        const isActive = activeId === track.id;
        return (
          <AlbumTrackRow
            key={track.id}
            track={track}
            index={index}
            isReorderable={isReorderable}
            isActive={isActive}
            activeTranslateY={activeTranslateY}
            activeScale={activeScale}
            otherTranslateY={animMap[track.id]}
            onPlay={() => onPlayTrack(track)}
            startDrag={startDrag}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
            onDragCancel={onDragCancel}
          />
        );
      })}
    </View>
  );
}

function AlbumTrackRow({
  track,
  index,
  isReorderable,
  isActive,
  activeTranslateY,
  activeScale,
  otherTranslateY,
  onPlay,
  startDrag,
  onDragMove,
  onDragEnd,
  onDragCancel,
}) {
  const panResponder = useMemo(() => {
    if (!isReorderable) return null;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        startDrag(index, track.id);
      },
      onPanResponderMove: (_event, gestureState) => {
        onDragMove(gestureState.dy);
      },
      onPanResponderRelease: () => {
        onDragEnd();
      },
      onPanResponderTerminate: () => {
        onDragCancel();
      },
    });
  }, [index, isReorderable, onDragCancel, onDragEnd, onDragMove, startDrag, track.id]);

  const rowTransform = isActive
    ? [{ translateY: activeTranslateY }, { scale: activeScale }]
    : [{ translateY: otherTranslateY ?? 0 }];

  return (
    <Animated.View
      style={[
        styles.trackRow,
        isActive && styles.draggingTrackRow,
        { transform: rowTransform },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Play ${track.title} by ${track.artist}`}
        onPress={onPlay}
        style={styles.trackPlayArea}
      >
        <Text style={styles.trackNumber}>{index + 1}</Text>
        <View style={styles.details}>
          <Text numberOfLines={1} style={styles.detailTrackTitle}>{track.title}</Text>
          <Text numberOfLines={1} style={styles.detailTrackArtist}>{track.artist}</Text>
        </View>
      </Pressable>
      {isReorderable ? (
        <View
          {...(panResponder?.panHandlers ?? {})}
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Drag to reorder ${track.title}`}
          accessibilityHint="Drag up or down to change position in playlist"
          style={[styles.dragHandle, isActive && styles.dragHandleActive]}
        >
          <View style={styles.dragDotsColumn}>
            {[0, 1, 2].map((dot) => (
              <View key={dot} style={[styles.dragDot, isActive && styles.dragDotActive]} />
            ))}
          </View>
          <View style={styles.dragDotsColumn}>
            {[0, 1, 2].map((dot) => (
              <View key={dot} style={[styles.dragDot, isActive && styles.dragDotActive]} />
            ))}
          </View>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: '100%' },
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14 },
  backButton: { width: 34, height: 36, justifyContent: 'center', marginRight: 4 },
  heading: { flex: 1, color: COLORS.ink, fontFamily: 'NunitoExtraBold', fontSize: 22 },
  headerAction: { width: 40, height: 40, marginLeft: 10, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.green },
  list: { gap: 5, paddingHorizontal: 18, paddingTop: 1 },
  explainer: { marginHorizontal: 5, marginBottom: 10, color: COLORS.muted, fontFamily: 'NunitoSemiBold', fontSize: 12, lineHeight: 18 },
  albumRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 5, paddingVertical: 5 },
  art: { width: 60, height: 60, borderRadius: 8 },
  details: { flex: 1, minWidth: 0 },
  title: { color: COLORS.ink, fontFamily: 'NunitoExtraBold', fontSize: 14 },
  artist: { color: '#5c554a', fontFamily: 'NunitoSemiBold', fontSize: 12 },
  meta: { color: COLORS.muted, fontFamily: 'NunitoRegular', fontSize: 11 },
  detailScroll: { flex: 1 },
  detailContent: { paddingHorizontal: 22, paddingTop: 10 },
  createForm: { paddingHorizontal: 18, paddingTop: 4, gap: 10 },
  coverPicker: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8, padding: 10, borderRadius: 13, backgroundColor: 'rgba(255,248,233,0.88)' },
  createCover: { width: 72, height: 72, borderRadius: 8 },
  coverPickerText: { flex: 1, gap: 3 },
  formLabel: { color: COLORS.ink, fontFamily: 'NunitoExtraBold', fontSize: 13 },
  formHint: { color: COLORS.muted, fontFamily: 'NunitoRegular', fontSize: 11 },
  textInput: { minHeight: 46, paddingHorizontal: 13, borderRadius: 10, color: COLORS.ink, fontFamily: 'NunitoSemiBold', fontSize: 13, backgroundColor: 'rgba(255,248,233,0.92)' },
  songPickerHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  selectTrackRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 5 },
  trackArt: { width: 42, height: 42, borderRadius: 7 },
  formMessage: { color: COLORS.red, fontFamily: 'NunitoBold', fontSize: 12 },
  saveAlbumButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 6, borderRadius: 24, backgroundColor: COLORS.green },
  saveAlbumLabel: { color: COLORS.cream, fontFamily: 'NunitoExtraBold', fontSize: 13 },
  deleteAlbumButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 18, borderRadius: 23, borderWidth: 1, borderColor: 'rgba(166,34,36,0.5)' },
  deleteAlbumLabel: { color: COLORS.red, fontFamily: 'NunitoExtraBold', fontSize: 12 },
  detailCover: { width: '78%', maxWidth: 310, aspectRatio: 1, alignSelf: 'center', borderRadius: 3, marginBottom: 23 },
  detailTitle: { color: COLORS.ink, fontFamily: 'NunitoExtraBold', fontSize: 28, lineHeight: 34 },
  albumMeta: { color: COLORS.muted, fontFamily: 'NunitoSemiBold', fontSize: 13, marginTop: 12 },
  albumActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 18, marginTop: 19, marginBottom: 15 },
  likeButton: { width: 44, height: 50, alignItems: 'flex-start', justifyContent: 'center' },
  shuffleButton: { width: 44, height: 50, alignItems: 'center', justifyContent: 'center' },
  deleteActionButton: { width: 44, height: 50, alignItems: 'center', justifyContent: 'center' },
  albumPlayButton: { width: 62, height: 62, marginLeft: 'auto', borderRadius: 31, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.green },
  trackList: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 248, 233, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(75, 59, 37, 0.12)',
    marginTop: 6,
    marginBottom: 4,
  },
  trackRow: {
    height: TRACK_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(75, 59, 37, 0.12)',
    backgroundColor: 'transparent',
  },
  draggingTrackRow: {
    zIndex: 99,
    elevation: 10,
    backgroundColor: '#fffdf6',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(23, 77, 56, 0.45)',
    shadowColor: '#174d38',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  emptyTrackList: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(75, 59, 37, 0.12)',
    backgroundColor: 'rgba(255, 248, 233, 0.45)',
    marginTop: 6,
    marginBottom: 4,
  },
  emptyTrackText: {
    color: COLORS.muted,
    fontFamily: 'NunitoSemiBold',
    fontSize: 13,
  },
  trackPlayArea: { flex: 1, minWidth: 0, height: '100%', flexDirection: 'row', alignItems: 'center', gap: 13 },
  dragHandle: {
    width: 44,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    ...(Platform.OS === 'web' ? { cursor: 'grab', userSelect: 'none' } : {}),
  },
  dragHandleActive: {
    ...(Platform.OS === 'web' ? { cursor: 'grabbing' } : {}),
  },
  dragDotsColumn: { gap: 4 },
  dragDot: { width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: COLORS.muted },
  dragDotActive: { backgroundColor: COLORS.green },
  trackNumber: { width: 20, color: COLORS.muted, fontFamily: 'NunitoSemiBold', fontSize: 13, textAlign: 'left' },
  detailTrackTitle: { color: COLORS.ink, fontFamily: 'NunitoSemiBold', fontSize: 15 },
  detailTrackArtist: { color: '#655c4e', fontFamily: 'NunitoRegular', fontSize: 12, marginTop: 3 },
  emptyMessage: { marginHorizontal: 5, marginTop: 15, color: COLORS.muted, fontFamily: 'NunitoSemiBold', fontSize: 13, lineHeight: 19 },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingTop: 7, backgroundColor: COLORS.cream, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(75, 59, 37, 0.2)' },
  navItem: { flex: 1, minWidth: 0, alignItems: 'center', gap: 1 },
  navLabel: { color: COLORS.muted, fontFamily: 'NunitoSemiBold', fontSize: 10 },
  selectedNavLabel: { color: COLORS.red, fontFamily: 'NunitoExtraBold' },
});
