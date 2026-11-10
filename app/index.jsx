import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import benjieBackgroundGif from '../assets/benjie_bg_loop.gif';
import benjieGif from '../assets/benjie.gif';
import emblemGif from '../assets/Animated MistleTunes Christmas Emblem.gif';
import emblemFallback from '../assets/mistletunes_adaptive_foreground.png';

// Benjie's GIF has 12 frames at 80 ms each (960 ms per run cycle).
// Three run cycles match the full progress-bar travel and intro duration.
const INTRO_DURATION_MS = 2880;
const LOGO_DURATION_MS = 3000;

export default function Index() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const emblemSize = Math.max(0, Math.min(width * 0.8, (height - insets.top - insets.bottom) * 0.65, 380));
  const [emblemReady, setEmblemReady] = useState(false);
  const [emblemFailed, setEmblemFailed] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
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
    if (!emblemReady) return;
    // Start the three seconds only after the emblem is actually displayed.
    SplashScreen.hide();
    const timer = setTimeout(() => setShowLoading(true), LOGO_DURATION_MS);
    return () => clearTimeout(timer);
  }, [emblemReady]);

  useEffect(() => {
    if (!showLoading) return;
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
  }, [loadingProgress, showLoading]);

  if (!showLoading) {
    return (
      <View style={[styles.screen, styles.emblemScreen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <StatusBar hidden />
        <Image
          source={emblemFailed ? emblemFallback : emblemGif}
          contentFit="contain"
          autoplay
          isAnimated={!emblemFailed}
          transition={0}
          accessibilityLabel="Animated MistleTunes Christmas emblem"
          onDisplay={() => setEmblemReady(true)}
          onError={() => {
            if (emblemFailed) setEmblemReady(true);
            else setEmblemFailed(true);
          }}
          style={{ width: emblemSize, height: emblemSize }}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar hidden />
      <Image source={benjieBackgroundGif} contentFit="cover" autoplay isAnimated style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={styles.tint} />

      <View style={[styles.loadingContent, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
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
  emblemScreen: { alignItems: 'center', justifyContent: 'center' },
  tint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 24, 16, 0.16)' },
  loadingContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingLabel: { color: '#fff8e9', fontFamily: 'NunitoExtraBold', fontSize: 20, textAlign: 'center', marginBottom: 8 },
  progressArea: { height: 102, justifyContent: 'flex-end', paddingBottom: 18 },
  character: { position: 'absolute', left: 0, bottom: 18, width: 122, height: 82 },
  benjieImage: { width: '100%', height: '100%' },
  progressTrack: { width: '100%', height: 9, overflow: 'hidden', borderRadius: 6, backgroundColor: 'rgba(255, 245, 231, 0.48)' },
  progressFill: { height: '100%', borderRadius: 6, backgroundColor: '#d92332' },
});
