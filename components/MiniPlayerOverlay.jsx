import { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Keyboard,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayback } from './PlaybackContext';
import SongArtwork from './SongArtwork';

export default function MiniPlayerOverlay() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [translateX] = useState(() => new Animated.Value(0));
  const { currentTrack, playing, togglePlayback, stopPlayback } = usePlayback();
  const bottomOffset = Math.max(insets.bottom, 8) + (pathname === '/RecentlyPlayed' ? 12 : 72);

  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => (
      Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy)
    ),
    onPanResponderMove: (_event, gesture) => translateX.setValue(gesture.dx),
    onPanResponderRelease: (_event, gesture) => {
      if (Math.abs(gesture.dx) > 90) {
        Animated.timing(translateX, {
          toValue: gesture.dx > 0 ? width : -width,
          duration: 160,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (!finished) return;
          stopPlayback();
          translateX.setValue(0);
        });
        return;
      }
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        speed: 22,
        bounciness: 5,
      }).start();
    },
    onPanResponderTerminate: () => {
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
    },
  }), [stopPlayback, translateX, width]);

  if (!currentTrack || keyboardVisible || pathname === '/Player') return null;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[styles.container, { bottom: bottomOffset, transform: [{ translateX }] }]}
    >
      <View style={styles.card}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${currentTrack.title} in player`}
          onPress={() => router.push('/Player')}
          style={styles.trackButton}
        >
          <SongArtwork source={currentTrack.artwork} style={styles.artwork} iconSize={19} accessibilityLabel={`${currentTrack.title} cover art`} />
          <View style={styles.trackText}>
            <Text numberOfLines={1} style={styles.title}>{currentTrack.title}</Text>
            <Text numberOfLines={1} style={styles.artist}>{currentTrack.artist || 'Unknown artist'}</Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause song' : 'Play song'}
          onPress={togglePlayback}
          hitSlop={8}
          style={styles.control}
        >
          <Ionicons name={playing ? 'pause' : 'play'} size={23} color="#164d38" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Stop and dismiss player"
          onPress={stopPlayback}
          hitSlop={8}
          style={styles.control}
        >
          <Ionicons name="close" size={22} color="#837866" />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 20,
    elevation: 12,
  },
  card: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderRadius: 15,
    backgroundColor: '#fff8e9',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(22, 77, 56, 0.2)',
    shadowColor: '#17140e',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  trackButton: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  artwork: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#164d38' },
  trackText: { flex: 1, minWidth: 0 },
  title: { color: '#29251e', fontFamily: 'NunitoBold', fontSize: 13 },
  artist: { color: '#837866', fontFamily: 'NunitoRegular', fontSize: 11, marginTop: 1 },
  control: { width: 38, height: 42, alignItems: 'center', justifyContent: 'center' },
});
