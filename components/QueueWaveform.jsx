import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

const BARS = [
  { restingScale: 0.35, peakScale: 0.8, duration: 390 },
  { restingScale: 0.6, peakScale: 1, duration: 280 },
  { restingScale: 0.45, peakScale: 0.9, duration: 460 },
  { restingScale: 0.25, peakScale: 0.7, duration: 330 },
];

function WaveformBar({ playing, reducedMotion, restingScale, peakScale, duration }) {
  const scale = useSharedValue(restingScale);

  useEffect(() => {
    cancelAnimation(scale);
    if (playing && !reducedMotion) {
      scale.value = restingScale;
      scale.value = withRepeat(withTiming(peakScale, { duration }), -1, true);
    } else {
      scale.value = withTiming(restingScale, { duration: reducedMotion ? 0 : 160 });
    }
    return () => cancelAnimation(scale);
  }, [duration, peakScale, playing, reducedMotion, restingScale, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: scale.value }],
  }));

  return <Animated.View style={[styles.bar, animatedStyle]} />;
}

// A playback indicator, rather than an amplitude measurement of the audio.
const QueueWaveform = memo(function QueueWaveform({ playing }) {
  const reducedMotion = useReducedMotion();
  return (
    <View style={styles.waveform} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {BARS.map((bar, index) => (
        <WaveformBar key={index} {...bar} playing={playing} reducedMotion={reducedMotion} />
      ))}
    </View>
  );
});

export default QueueWaveform;

const styles = StyleSheet.create({
  waveform: { width: 22, height: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  bar: { width: 3, height: 18, borderRadius: 2, backgroundColor: '#f4c86a' },
});
