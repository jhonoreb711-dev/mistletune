import { Alert, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { ImageBackground } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { usePlayback } from './PlaybackContext';
import { useFavorites } from './FavoritesContext';
import SongArtwork from './SongArtwork';
import christmasBackground from '../assets/christmas_bg.png';

const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export default function PlayerScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const {
    currentTrack,
    playing,
    currentTime,
    duration,
    togglePlayback,
    skip,
    seekTo,
    toggleShuffle,
    shuffleEnabled,
    canShuffle,
    loopMode,
    toggleLoopMode,
    editTrackArtwork,
    clearTrackArtwork,
  } = usePlayback();
  const { isTrackFavorite, toggleTrackFavorite } = useFavorites();
  const [trackWidth, setTrackWidth] = useState(0);
  const [scrubbingTime, setScrubbingTime] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const scrubbingTimeRef = useRef(null);
  const feedbackTimerRef = useRef(null);
  const track = currentTrack;
  const displayedTime = scrubbingTime ?? currentTime;
  const progress = duration ? Math.max(0, Math.min(displayedTime / duration, 1)) : 0;
  const coverSize = Math.max(152, Math.min(width * 0.76, (height - insets.top - insets.bottom) * 0.35, 280));

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const showFeedback = (text, icon) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setFeedback({ text, icon });
    feedbackTimerRef.current = setTimeout(() => {
      setFeedback(null);
    }, 1800);
  };

  const handleShufflePress = () => {
    if (!canShuffle) {
      showFeedback('Need at least 2 songs to shuffle', 'alert-circle-outline');
      return;
    }
    const isEnabled = toggleShuffle();
    showFeedback(isEnabled ? 'Shuffle on' : 'Shuffle off', 'shuffle');
  };

  const handleRepeatPress = () => {
    const nextMode = toggleLoopMode();
    if (nextMode === 'all') {
      showFeedback('Repeat playlist on', 'repeat');
    } else if (nextMode === 'single') {
      showFeedback('Repeat current song on', 'repeat');
    } else {
      showFeedback('Repeat off', 'repeat');
    }
  };

  const timeFromTouch = (event) => {
    if (!duration || !trackWidth) return null;
    const x = Math.max(0, Math.min(trackWidth, event.nativeEvent.locationX));
    return (x / trackWidth) * duration;
  };

  const previewSeek = (event) => {
    const nextTime = timeFromTouch(event);
    if (nextTime === null) return;
    scrubbingTimeRef.current = nextTime;
    setScrubbingTime(nextTime);
  };

  const finishSeek = (event) => {
    const nextTime = timeFromTouch(event) ?? scrubbingTimeRef.current;
    if (nextTime !== null) seekTo(nextTime);
    scrubbingTimeRef.current = null;
    setScrubbingTime(null);
  };

  const editCover = () => {
    if (!track) return;
    const changeCover = async () => {
      try {
        await editTrackArtwork(track.id);
      } catch {
        Alert.alert('Could not change cover', 'Please choose another image and try again.');
      }
    };
    const actions = [{ text: 'Change cover', onPress: changeCover }];
    if (track.artwork) {
      actions.push({ text: 'Remove cover', style: 'destructive', onPress: () => clearTrackArtwork(track.id).catch(() => Alert.alert('Could not remove cover', 'Please try again.')) });
    }
    actions.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Song cover', 'Choose an image for this song.', actions);
  };

  return (
    <ImageBackground source={christmasBackground} contentFit="cover" style={styles.background}>
      <View style={styles.overlay} />
      <View style={[styles.screen, { paddingTop: insets.top + 20, paddingBottom: Math.max(insets.bottom, 8) + 8 }]}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-down" size={28} color="white" />
          </Pressable>
          <Text style={styles.nowPlaying}>NOW PLAYING</Text>
          <View style={styles.topBarSpacer} />
        </View>
        <View style={styles.playerContent}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={track?.artwork ? 'Edit song cover' : 'Add song cover'}
            accessibilityHint="Choose or remove the artwork for this song"
            disabled={!track}
            onPress={editCover}
            style={[styles.coverButton, { width: coverSize }]}
          >
            <SongArtwork source={track?.artwork} iconSize={112} style={[styles.cover, { width: '100%' }]} />
          </Pressable>
          <View style={styles.trackInfo}>
            <View style={styles.trackText}>
              <Text numberOfLines={2} style={styles.title}>{track?.title ?? 'Choose a song'}</Text>
              <Text numberOfLines={2} style={styles.artist}>{track?.artist ?? ' '}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={track && isTrackFavorite(track.id) ? 'Remove song from favorites' : 'Add song to favorites'}
              disabled={!track}
              onPress={() => track && toggleTrackFavorite(track.id)}
              hitSlop={10}
            >
              <Ionicons name={track && isTrackFavorite(track.id) ? 'heart' : 'heart-outline'} size={25} color={track && isTrackFavorite(track.id) ? '#d83a43' : 'white'} />
            </Pressable>
          </View>
          <View>
            <View
              accessibilityRole="adjustable"
              accessibilityLabel="Playback position"
              accessibilityValue={{ min: 0, max: duration, now: displayedTime }}
              onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
              onStartShouldSetResponder={() => duration > 0}
              onMoveShouldSetResponder={() => duration > 0}
              onResponderGrant={previewSeek}
              onResponderMove={previewSeek}
              onResponderRelease={finishSeek}
              onResponderTerminate={finishSeek}
              style={styles.progressTrack}
            >
              <View pointerEvents="none" style={styles.progressRail} />
              <View pointerEvents="none" style={[styles.progressFill, { width: `${progress * 100}%` }]} />
              <View pointerEvents="none" style={[styles.knob, { left: `${progress * 100}%` }]} />
            </View>
            <View style={styles.timeRow}><Text style={styles.time}>{formatTime(displayedTime)}</Text><Text style={styles.time}>{formatTime(duration)}</Text></View>
          </View>
          {feedback ? (
            <View pointerEvents="none" style={styles.feedbackToast}>
              <Ionicons name={feedback.icon} size={15} color="#fff8e9" style={styles.feedbackIcon} />
              <Text style={styles.feedbackText}>{feedback.text}</Text>
            </View>
          ) : (
            <View style={styles.feedbackSpacer} />
          )}

          <View style={styles.controls}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={shuffleEnabled ? 'Shuffle on (tap to turn off)' : 'Shuffle off (tap to turn on)'}
              accessibilityState={{ selected: shuffleEnabled, disabled: !canShuffle }}
              disabled={!canShuffle}
              onPress={handleShufflePress}
              hitSlop={10}
              style={[styles.secondaryControl, shuffleEnabled && styles.secondaryControlActive]}
            >
              <Ionicons
                name="shuffle"
                size={24}
                color={!canShuffle ? 'rgba(255,255,255,0.38)' : shuffleEnabled ? '#174d38' : 'white'}
              />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Previous track" onPress={() => skip(-1)} hitSlop={10}>
              <Ionicons name="play-skip-back" size={28} color="white" />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Pause' : 'Play'} onPress={togglePlayback} style={styles.playButton}>
              <Ionicons name={playing ? 'pause' : 'play'} size={30} color="#174d38" />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Next track" onPress={() => skip(1)} hitSlop={10}>
              <Ionicons name="play-skip-forward" size={28} color="white" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={loopMode === 'single' ? 'Repeat current song (tap to turn off)' : loopMode === 'all' ? 'Repeat playlist (tap for repeat current song)' : 'Repeat off (tap to repeat playlist)'}
              accessibilityState={{ selected: loopMode !== 'none' }}
              onPress={handleRepeatPress}
              hitSlop={10}
              style={[styles.secondaryControl, loopMode !== 'none' && styles.secondaryControlActive]}
            >
              <Ionicons
                name="repeat"
                size={23}
                color={loopMode !== 'none' ? '#174d38' : 'rgba(255,255,255,0.72)'}
              />
              {loopMode === 'single' ? (
                <View style={styles.repeatBadge}>
                  <Text style={styles.repeatBadgeText}>1</Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>
        <View style={styles.device}><Ionicons name="phone-portrait-outline" size={15} color="white" /><Text style={styles.deviceText}>Playing on this device</Text></View>
      </View>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <Defs>
            <LinearGradient id="playerTopEdge" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#000" stopOpacity="0.24" /><Stop offset="1" stopColor="#000" stopOpacity="0" /></LinearGradient>
            <LinearGradient id="playerBottomEdge" x1="0" y1="1" x2="0" y2="0"><Stop offset="0" stopColor="#000" stopOpacity="0.24" /><Stop offset="1" stopColor="#000" stopOpacity="0" /></LinearGradient>
            <LinearGradient id="playerLeftEdge" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#000" stopOpacity="0.18" /><Stop offset="1" stopColor="#000" stopOpacity="0" /></LinearGradient>
            <LinearGradient id="playerRightEdge" x1="1" y1="0" x2="0" y2="0"><Stop offset="0" stopColor="#000" stopOpacity="0.18" /><Stop offset="1" stopColor="#000" stopOpacity="0" /></LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={width} height="38" fill="url(#playerTopEdge)" />
          <Rect x="0" y={height - 38} width={width} height="38" fill="url(#playerBottomEdge)" />
          <Rect x="0" y="0" width="24" height={height} fill="url(#playerLeftEdge)" />
          <Rect x={width - 24} y="0" width="24" height={height} fill="url(#playerRightEdge)" />
        </Svg>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#09261f' },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(3, 23, 20, 0.40)' },
  screen: { flex: 1, paddingHorizontal: 25 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 32 },
  topBarSpacer: { width: 28 },
  nowPlaying: { color: 'white', fontFamily: 'NunitoExtraBold', fontSize: 12, letterSpacing: 1.2 },
  cover: { maxWidth: 300, aspectRatio: 1, borderRadius: 16, backgroundColor: '#12372b', alignSelf: 'center' },
  coverButton: { maxWidth: 300, aspectRatio: 1, alignSelf: 'center' },
  playerContent: { flex: 1, justifyContent: 'center', gap: 16 },
  trackInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  trackText: { flex: 1 },
  title: { color: 'white', fontFamily: 'NunitoExtraBold', fontSize: 20 },
  artist: { color: 'rgba(255,255,255,0.88)', fontFamily: 'NunitoSemiBold', fontSize: 12, marginTop: 1 },
  progressTrack: { height: 28, justifyContent: 'center' },
  progressRail: { position: 'absolute', top: 12, left: 0, right: 0, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.46)' },
  progressFill: { position: 'absolute', top: 12, left: 0, height: 4, borderRadius: 2, backgroundColor: '#fff' },
  knob: { position: 'absolute', top: 8, width: 13, height: 13, borderWidth: 2, borderColor: '#174d38', borderRadius: 7, marginLeft: -6.5, backgroundColor: '#fff', elevation: 3, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 3 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { color: 'rgba(255,255,255,0.76)', fontFamily: 'NunitoSemiBold', fontSize: 11 },
  feedbackSpacer: { height: 28 },
  feedbackToast: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(3, 23, 20, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 248, 233, 0.28)',
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  feedbackIcon: { marginRight: 6 },
  feedbackText: {
    color: '#fff8e9',
    fontFamily: 'NunitoBold',
    fontSize: 12,
    letterSpacing: 0.3,
  },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  secondaryControl: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19 },
  secondaryControlActive: { backgroundColor: '#fff8e9' },
  repeatBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#174d38',
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatBadgeText: {
    color: '#fff8e9',
    fontSize: 8,
    fontFamily: 'NunitoBold',
    lineHeight: 10,
  },
  playButton: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff8e9' },
  device: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, alignSelf: 'center', marginTop: 'auto', marginBottom: 2, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: 'rgba(3, 23, 20, 0.72)' },
  deviceText: { color: 'white', fontFamily: 'NunitoExtraBold', fontSize: 11 },
});
