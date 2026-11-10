import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import benjieBackgroundGif from '../assets/benjie_bg_loop.gif';
import benjieGif from '../assets/benjie.gif';
import mistletunesLogo from '../assets/mistletunes_adaptive_foreground.png';

// Benjie's GIF has 12 frames at 80 ms each (960 ms per run cycle).
// Three run cycles match the full progress-bar travel and intro duration.
const INTRO_DURATION_MS = 2880;

export default function Index() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const logoSize = Math.max(0, Math.min(width * 0.65, (height - insets.top - insets.bottom) * 0.38, 280));
  const [loadingProgress] = useState(() => new Animated.Value(0));
  const [loadingDots, setLoadingDots] = useState(0);
  const progressWidth = Math.max(150, Math.min(width - 112, 280));
  const characterTravel = Math.max(0, progressWidth - 122);
  const fillWidth = loadingProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, progressWidth],
  });
  const benjiePosition = loadingProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, characterTravel],
  });

  useEffect(() => {
    const loadingAnimation = Animated.timing(loadingProgress, {
      toValue: 1,
      duration: INTRO_DURATION_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    loadingAnimation.start();
    const dotsTimer = setInterval(() => {
      setLoadingDots((currentDots) => (currentDots + 1) % 4);
    }, 350);
    const redirectTimer = setTimeout(() => router.replace('/Music'), INTRO_DURATION_MS);

    return () => {
      loadingAnimation.stop();
      clearInterval(dotsTimer);
      clearTimeout(redirectTimer);
    };
  }, [loadingProgress]);

  return (
    <View style={styles.screen}>
      <StatusBar hidden />
      <Image source={benjieBackgroundGif} contentFit="cover" autoplay isAnimated style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={styles.tint} />

      <View style={[styles.loadingContent, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Image
          source={mistletunesLogo}
          contentFit="contain"
          accessibilityLabel="MistleTunes logo"
          style={{ width: logoSize, aspectRatio: 1, marginBottom: 20 }}
        />
        <Text style={styles.loadingLabel}>Loading{'.'.repeat(loadingDots)}</Text>
        <View style={[styles.progressArea, { width: progressWidth }]}>
          <Animated.View style={[styles.character, { transform: [{ translateX: benjiePosition }] }]}>
            <Image source={benjieGif} contentFit="contain" autoplay isAnimated style={styles.benjieImage} />
          </Animated.View>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: fillWidth }]} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden', backgroundColor: '#073c2c' },
  tint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 24, 16, 0.16)' },
  loadingContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingLabel: { color: '#fff8e9', fontFamily: 'NunitoExtraBold', fontSize: 20, textAlign: 'center', marginBottom: 8 },
  progressArea: { height: 102, justifyContent: 'flex-end', paddingBottom: 18 },
  character: { position: 'absolute', left: 0, bottom: 18, width: 122, height: 82 },
  benjieImage: { width: '100%', height: '100%' },
  progressTrack: { width: '100%', height: 9, overflow: 'hidden', borderRadius: 6, backgroundColor: 'rgba(255, 245, 231, 0.48)' },
  progressFill: { height: '100%', borderRadius: 6, backgroundColor: '#d92332' },
});
