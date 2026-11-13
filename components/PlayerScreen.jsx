import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { ImageBackground } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useIsFocused } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { usePlayback } from './PlaybackContext';
import { useFavorites } from './FavoritesContext';
import SongArtwork from './SongArtwork';
import SongCoverDialog from './SongCoverDialog';
import LyricsScreen from './LyricsScreen';
import HighwayPlayerArtwork from './HighwayPlayerArtwork';
import christmasBackground from '../assets/christmas_bg.png';

const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export default function PlayerScreen() {
  const isFocused = useIsFocused();
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
  const [playerView, setPlayerView] = useState(0);
  const [coverTarget, setCoverTarget] = useState(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverError, setCoverError] = useState(null);
  const [lyricsVisible, setLyricsVisible] = useState(false);
  const artworkPagerRef = useRef(null);
  const scrubbingTimeRef = useRef(null);
  const feedbackTimerRef = useRef(null);
  const track = currentTrack;
  const displayedTime = scrubbingTime ?? currentTime;
  const progress = duration ? Math.max(0, Math.min(displayedTime / duration, 1)) : 0;
  const pageWidth = Math.max(1, width - 16 - insets.left - insets.right);
  const coverSize = Math.max(96, Math.min(pageWidth, (height - insets.top - insets.bottom) * 0.35, 280));

  useEffect(() => {
    artworkPagerRef.current?.scrollTo({ x: playerView * pageWidth, animated: false });
  }, [pageWidth, playerView]);

  const changePlayerView = (index) => artworkPagerRef.current?.scrollTo({ x: index * pageWidth, animated: true });

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
    setCoverError(null);
    setCoverTarget(track);
  };

  const updateCover = async (remove = false) => {
    if (!coverTarget || coverBusy) return;
    setCoverBusy(true);
    setCoverError(null);
    try {
      if (remove) await clearTrackArtwork(coverTarget.id);
      else await editTrackArtwork(coverTarget.id);
      setCoverTarget(null);
    } catch {
      setCoverError(remove ? 'Could not remove the cover. Please try again.' : 'Could not save that image. Please choose another one.');
    } finally {
      setCoverBusy(false);
    }
  };

  return (
    <>
    {lyricsVisible && <LyricsScreen onClose={() => setLyricsVisible(false)} />}
    <SongCoverDialog track={coverTarget} busy={coverBusy} error={coverError} onClose={() => setCoverTarget(null)} onChange={() => updateCover(false)} onRemove={() => updateCover(true)} />
    <ImageBackground source={christmasBackground} contentFit="cover" style={styles.background}>
      <View style={styles.overlay} />
      <View style={[styles.screen, { paddingLeft: 8 + insets.left, paddingRight: 8 + insets.right, paddingTop: insets.top + 20, paddingBottom: Math.max(insets.bottom, 8) + 8 }]}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-down" size={28} color="white" />
          </Pressable>
          <Text style={styles.nowPlaying}>NOW PLAYING</Text>
          <View style={styles.topBarSpacer} />
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.playerContent, { gap: height < 700 ? 10 : 16 }]} showsVerticalScrollIndicator={false}>
          <ScrollView
            ref={artworkPagerRef}
            horizontal
            pagingEnabled
            directionalLockEnabled
            showsHorizontalScrollIndicator={false}
            style={{ width: pageWidth, height: coverSize, flexGrow: 0, flexShrink: 0 }}
            onMomentumScrollEnd={(event) => setPlayerView(Math.max(0, Math.min(1, Math.round(event.nativeEvent.contentOffset.x / pageWidth))))}
          >
            {[0, 1].map((index) => (
              <View key={index} style={{ width: pageWidth, height: coverSize, alignItems: 'center', justifyContent: 'center' }}>
                {index === 0 ? <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={index === 0 ? 'Album artwork: edit cover' : 'CD Highway animation: edit song cover'}
                  accessibilityHint="Tap to change the cover. Swipe left or right to change player style."
                  disabled={!track}
                  onPress={editCover}
                  style={{ width: index === 0 ? coverSize : pageWidth, height: coverSize, alignItems: 'center', justifyContent: 'center' }}
                >
                  <SongArtwork source={track?.artwork} contentFit="contain" iconSize={coverSize * 0.4} style={[styles.cover, { width: coverSize, height: coverSize }]} />
                </Pressable> : <HighwayPlayerArtwork width={pageWidth} height={coverSize} active={playing && playerView === 1 && isFocused} artwork={track?.artwork} onEditCover={editCover} editable={Boolean(track)} />}
              </View>
            ))}
          </ScrollView>
          <View style={styles.playerOptions}>
            <View style={styles.viewSelector}>
            {['Classic', 'CD Highway'].map((label, index) => (
              <Pressable key={label} accessibilityRole="button" accessibilityLabel={`Show ${label} player`} accessibilityState={{ selected: playerView === index }} onPress={() => changePlayerView(index)} style={[styles.viewOption, playerView === index && styles.viewOptionActive]}>
                <View style={[styles.viewDot, playerView === index && styles.viewDotActive]} />
                <Text style={[styles.viewLabel, playerView === index && styles.viewLabelActive]}>{label}</Text>
              </Pressable>
            ))}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Open offline lyrics" accessibilityState={{ disabled: !track }} disabled={!track} onPress={() => setLyricsVisible(true)} style={[styles.lyricsButton, !track && styles.lyricsButtonDisabled]}>
              <Ionicons name="document-text-outline" size={18} color="#f4c86a" />
              <Text style={styles.lyricsButtonText}>Lyrics</Text>
            </Pressable>
          </View>
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
        </ScrollView>
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
    </>
  );
}

const styles = StyleSheet.create({
  playerOptions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8 },
  lyricsButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 12, borderRadius: 23, backgroundColor: 'rgba(3,23,20,0.8)', borderWidth: 1, borderColor: 'rgba(244,200,106,0.45)' },
  lyricsButtonDisabled: { opacity: 0.45 },
  lyricsButtonText: { color: '#f4c86a', fontFamily: 'NunitoBold', fontSize: 11 },
  viewSelector: { flexDirection: 'row', alignSelf: 'center', gap: 6, padding: 3, borderRadius: 22, backgroundColor: 'rgba(3,23,20,0.8)', borderWidth: 1, borderColor: 'rgba(244,200,106,0.3)' },
  viewOption: { minHeight: 38, paddingHorizontal: 14, borderRadius: 19, flexDirection: 'row', alignItems: 'center', gap: 7 },
  viewOptionActive: { backgroundColor: '#fff8e9' },
  viewDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#baa878' },
  viewDotActive: { backgroundColor: '#174d38' },
  viewLabel: { color: '#e2d2ad', fontFamily: 'NunitoBold', fontSize: 11 },
  viewLabelActive: { color: '#174d38' },
  background: { flex: 1, backgroundColor: '#09261f' },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(3, 23, 20, 0.40)' },
  screen: { flex: 1, paddingHorizontal: 25 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 32 },
  topBarSpacer: { width: 28 },
  nowPlaying: { color: 'white', fontFamily: 'NunitoExtraBold', fontSize: 12, letterSpacing: 1.2 },
  cover: { maxWidth: 300, aspectRatio: 1, borderRadius: 16, backgroundColor: '#12372b', alignSelf: 'center' },
  coverButton: { maxWidth: 300, aspectRatio: 1, alignSelf: 'center' },
  playerContent: { flexGrow: 1, paddingVertical: 16, justifyContent: 'center', gap: 16 },
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
