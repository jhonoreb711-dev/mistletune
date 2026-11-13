import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import highwayGif from '../assets/CD_Highway_box.gif';

export default function HighwayPlayerArtwork({ width, height, active, artwork, onEditCover, editable }) {
  const imageRef = useRef(null);
  const [rotation] = useState(() => new Animated.Value(0));
  // Follow the hub through the same proportional scaling/cropping as the GIF.
  const scale = Math.max((width - 2) / 475, (height - 2) / 413);
  const hubSize = 56 * scale;
  const hubLeft = 1 + (width - 2 - 475 * scale) / 2 + 197 * scale - hubSize / 2;
  const hubTop = 1 + (height - 2 - 413 * scale) / 2 + 203 * scale - hubSize / 2;
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
      <Image ref={imageRef} source={highwayGif} contentFit="cover" contentPosition="center" autoplay={active}
        isAnimated onLoad={syncAnimation} accessibilityLabel="Animated CD Highway music visualizer"
        style={StyleSheet.absoluteFill} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={artwork ? 'Change CD center cover' : 'Add CD center cover'}
        accessibilityHint="Choose an image for this song"
        disabled={!editable}
        onPress={onEditCover}
        hitSlop={Math.max(4, (44 - hubSize) / 2)}
        style={{ position: 'absolute', left: hubLeft, top: hubTop, width: hubSize, height: hubSize, borderRadius: hubSize / 2 }}
      >
        {artwork ? <Animated.View style={{ flex: 1, borderRadius: hubSize / 2, overflow: 'hidden', borderWidth: 2, borderColor: '#b5b6b5', backgroundColor: '#222', transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
          <Image source={artwork} contentFit="cover" style={StyleSheet.absoluteFill} />
        </Animated.View> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', borderRadius: 18, backgroundColor: '#071a16', borderWidth: 1, borderColor: 'rgba(244,200,106,0.5)' },
});
