import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import highwayGif from '../assets/output_cd.gif';
import { useThemeStyles } from '../themes/ThemeProvider';

export default function SpinningRecordArtwork({ width, height, active, artwork, onEditCover, editable }) {
  const { styles } = useThemeStyles(createStyles, BASE_COLORS);
  const imageRef = useRef(null);
  const [rotation] = useState(() => new Animated.Value(0));
  // Coordinates of the white label in the original 480 x 270 GIF.
  // Contain the whole record so its label stays aligned on every screen size.
  const scale = Math.min((width - 2) / 480, (height - 2) / 270);
  const originX = 1 + (width - 2 - 480 * scale) / 2;
  const originY = 1 + (height - 2 - 270 * scale) / 2;
  const labelWidth = 510 * scale;
  const labelHeight = 225 * scale;
  const labelLeft = originX + 145 * scale;
  const labelTop = originY - 45 * scale;
  useEffect(() => {
    let cancelled = false;
    let animation;
    rotation.stopAnimation((value) => {
      if (!active || !artwork || cancelled) return;
      const turn = (start) => {
        rotation.setValue(start);
        animation = Animated.timing(rotation, { toValue: 1, duration: (1 - start) * 10000, easing: Easing.linear, useNativeDriver: true });
        animation.start(({ finished }) => { if (finished && !cancelled) turn(0); });
      };
      turn(value % 1);
    });
    return () => { cancelled = true; animation?.stop(); };
  }, [rotation, active, artwork]);
  const syncAnimation = () => {
    const image = imageRef.current;
    if (!image) return;
    const operation = active ? image.startAnimating() : image.stopAnimating();
    operation?.catch(() => {});
  };
  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;
    const operation = active ? image.startAnimating() : image.stopAnimating();
    operation?.catch(() => {});
  }, [active]);

  return (
    <View style={[styles.frame, { width, height }]}>
      <Image ref={imageRef} source={highwayGif} contentFit="contain" contentPosition="center" autoplay={active}
        isAnimated onLoad={syncAnimation} accessibilityLabel="Animated spinning record with a customizable white label"
        style={StyleSheet.absoluteFill} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={artwork ? 'Change spinning record cover' : 'Import a cover onto the white record label'}
        accessibilityHint="Choose an image for this song"
        disabled={!editable}
        onPress={onEditCover}
        hitSlop={4}
        style={{ position: 'absolute', left: labelLeft, top: labelTop, width: labelWidth, height: labelHeight, borderRadius: labelWidth / 2, overflow: 'hidden' }}
      >
        {artwork ? <View pointerEvents="none" style={{ width: labelWidth, height: labelWidth, position: 'absolute', top: (labelHeight - labelWidth) / 2, transform: [{ scaleY: labelHeight / labelWidth }] }}>
          <Animated.View style={{ flex: 1, borderRadius: labelWidth / 2, overflow: 'hidden', transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
            <Image source={artwork} contentFit="cover" style={StyleSheet.absoluteFill} />
          </Animated.View>
        </View> : null}
      </Pressable>
      {artwork ? <View pointerEvents="none" style={{ position: 'absolute', left: originX + 394 * scale, top: originY + 16 * scale, width: 30 * scale, height: 47 * scale, borderRadius: 12 * scale, backgroundColor: '#080b0c' }} /> : null}
    </View>
  );
}

const BASE_COLORS = {
  greenDeep: '#071a16',
};

const createStyles = (colors) => StyleSheet.create({
  frame: { overflow: 'hidden', borderRadius: 18, backgroundColor: colors.greenDeep, borderWidth: 1, borderColor: 'rgba(244,200,106,0.5)' },
});
