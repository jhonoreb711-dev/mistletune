import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import SongArtwork from './SongArtwork';

export default function SpinningRecord({ artwork, size, spinning }) {
  const [rotation] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let cancelled = false;
    let animation;
    rotation.stopAnimation((value) => {
      if (!spinning || cancelled) return;
      const turn = (start) => {
        rotation.setValue(start);
        animation = Animated.timing(rotation, {
          toValue: 1,
          duration: (1 - start) * 12000,
          easing: Easing.linear,
          useNativeDriver: true,
        });
        animation.start(({ finished }) => { if (finished && !cancelled) turn(0); });
      };
      turn(value % 1);
    });
    return () => { cancelled = true; animation?.stop(); };
  }, [rotation, spinning]);

  return (
    <View style={[styles.plinth, { width: size, height: size }]}>
      <Animated.View style={[styles.disc, { transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}>
        {[0.92, 0.84, 0.76, 0.68].map((fraction) => <View key={fraction} style={[styles.groove, { width: `${fraction * 100}%`, height: `${fraction * 100}%` }]} />)}
        <SongArtwork source={artwork} iconSize={size * 0.17} contentFit="contain" style={styles.label} />
        <View style={styles.spindle} />
      </Animated.View>
      <View pointerEvents="none" style={styles.arm}><View style={styles.needle} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  plinth: { alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: 'rgba(7,35,27,0.78)', borderWidth: 1, borderColor: 'rgba(244,200,106,0.45)', padding: 12 },
  disc: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: '#101915', borderWidth: 3, borderColor: '#253b31' },
  groove: { position: 'absolute', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(244,200,106,0.15)' },
  label: { width: '49%', height: '49%', borderRadius: 999, backgroundColor: '#164d38', overflow: 'hidden' },
  spindle: { position: 'absolute', width: 9, height: 9, borderRadius: 5, backgroundColor: '#fff8e9', borderWidth: 2, borderColor: '#b58a3c' },
  arm: { position: 'absolute', width: 6, height: '43%', right: '16%', top: '8%', backgroundColor: '#e6c779', borderRadius: 4, transform: [{ rotate: '-25deg' }] },
  needle: { position: 'absolute', bottom: -4, left: -3, width: 12, height: 24, borderRadius: 3, backgroundColor: '#8e1420', borderWidth: 1, borderColor: '#e6c779' },
});
