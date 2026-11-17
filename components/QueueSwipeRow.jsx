import { useCallback, useEffect, useRef } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, runOnJS, useAnimatedStyle, useDerivedValue, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import SongArtwork from './SongArtwork';
import QueueWaveform from './QueueWaveform';
import { swipeRemovalDirection } from './queueUtils';

export default function QueueSwipeRow({ track, isCurrent, playing, indexLabel, enabled, onPlay, onRemove, onSwipingChange, dragHandle, scrollGesture, styles }) {
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const translation = useSharedValue(0);
  const settling = useSharedValue(false);
  const mounted = useRef(false);
  const latest = useRef({ onRemove, onSwipingChange });
  useEffect(() => { latest.current = { onRemove, onSwipingChange }; }, [onRemove, onSwipingChange]);

  const releaseSwipe = useCallback(() => latest.current.onSwipingChange(false), []);
  const beginSwipe = useCallback(() => latest.current.onSwipingChange(true), []);
  const restoreRow = useCallback(() => {
    'worklet';
    settling.set(true);
    translation.set(withTiming(0, { duration: reducedMotion ? 0 : 180 }, (finished) => {
      if (finished) {
        settling.set(false);
        runOnJS(releaseSwipe)();
      }
    }));
  }, [reducedMotion, releaseSwipe, settling, translation]);

  const commitRemoval = useCallback(() => {
    if (!mounted.current) return;
    if (latest.current.onRemove() !== true) {
      restoreRow();
      return;
    }
    releaseSwipe();
  }, [releaseSwipe, restoreRow]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelAnimation(translation);
      releaseSwipe();
    };
  }, [releaseSwipe, translation]);

  const gestureEnabled = useDerivedValue(() => enabled && !settling.get());
  const swipe = usePanGesture({
    enabled: gestureEnabled,
    activeOffsetX: [-8, 8],
    failOffsetY: [-12, 12],
    maxPointers: 1,
    block: scrollGesture,
    onActivate: (event) => {
      'worklet';
      translation.set(event.translationX);
      runOnJS(beginSwipe)();
    },
    onUpdate: (event) => {
      'worklet';
      translation.set(event.translationX);
    },
    onDeactivate: (event) => {
      'worklet';
      const direction = event.canceled ? 0 : swipeRemovalDirection(event.translationX, event.velocityX, width);
      if (!direction) {
        restoreRow();
        return;
      }
      settling.set(true);
      translation.set(withTiming(direction * (width + 32), { duration: reducedMotion ? 0 : 180 }, (finished) => {
        if (finished) runOnJS(commitRemoval)();
      }));
    },
  });
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translation.get() }],
    opacity: Math.max(0, 1 - Math.abs(translation.get()) / width),
  }));

  return (
    <View style={styles.rowContainer}>
      <Animated.View style={[styles.row, isCurrent && styles.rowNowPlaying, animatedStyle]}>
        <GestureDetector gesture={swipe} touchAction="pan-y">
          <View style={styles.rowPlayArea} collapsable={false}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isCurrent ? `${playing ? 'Now playing' : 'Paused'} ${track.title} by ${track.artist}` : `Play ${track.title} by ${track.artist}`}
              accessibilityHint="Swipe left or right to remove this song from the queue"
              accessibilityActions={[{ name: 'remove', label: 'Remove from queue' }]}
              onAccessibilityAction={(event) => { if (enabled && event.nativeEvent.actionName === 'remove') commitRemoval(); }}
              disabled={!enabled}
              onPress={() => { if (!settling.get() && Math.abs(translation.get()) < 1) onPlay(); }}
              style={styles.rowPlayArea}
            >
              {isCurrent ? <QueueWaveform playing={playing} /> : <Text style={styles.rowNumber}>{indexLabel}</Text>}
              <SongArtwork source={track.artwork} style={styles.artwork} iconSize={17} />
              <View style={styles.rowText}>
                <Text numberOfLines={1} style={[styles.rowTitle, isCurrent && styles.rowTitleNowPlaying]}>{track.title}</Text>
                <Text numberOfLines={1} style={styles.rowArtist}>{track.artist || 'Unknown artist'}</Text>
              </View>
            </Pressable>
          </View>
        </GestureDetector>
        {dragHandle}
      </Animated.View>
    </View>
  );
}
