import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

export default function SongArtwork({ source, style, iconSize = 28, accessibilityLabel = 'Music artwork' }) {
  if (source) {
    return (
      <Image
        key={typeof source === 'object' && source?.uri ? source.uri : 'artwork'}
        accessibilityLabel={accessibilityLabel}
        source={source}
        contentFit="cover"
        style={style}
        transition={120}
      />
    );
  }

  return (
    <View accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={[styles.cover, style]}>
      <View pointerEvents="none" style={styles.glow} />
      <View pointerEvents="none" style={styles.orbit} />
      <View style={styles.noteCircle}>
        <Ionicons name="musical-notes" size={iconSize} color="#fff4d6" />
      </View>
      <View pointerEvents="none" style={[styles.snow, styles.snowOne]} />
      <View pointerEvents="none" style={[styles.snow, styles.snowTwo]} />
      <View pointerEvents="none" style={[styles.snow, styles.snowThree]} />
      <View pointerEvents="none" style={[styles.snow, styles.snowFour]} />
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#103b2d',
  },
  glow: {
    position: 'absolute',
    width: '110%',
    height: '110%',
    borderRadius: 999,
    backgroundColor: '#1d6247',
    top: '42%',
    left: '28%',
  },
  orbit: {
    position: 'absolute',
    width: '70%',
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 244, 214, 0.28)',
  },
  noteCircle: {
    width: '56%',
    aspectRatio: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 244, 214, 0.75)',
    backgroundColor: 'rgba(5, 37, 28, 0.46)',
  },
  snow: { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: '#fff4d6' },
  snowOne: { top: '18%', left: '23%' },
  snowTwo: { top: '28%', right: '19%', width: 3, height: 3 },
  snowThree: { bottom: '20%', left: '18%', width: 3, height: 3 },
  snowFour: { right: '25%', bottom: '17%' },
});
