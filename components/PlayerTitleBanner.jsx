import { useEffect, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

export default function PlayerTitleBanner({ title, color, active }) {
  const [offset] = useState(() => new Animated.Value(0));
  const [viewport, setViewport] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    offset.setValue(0);
    const overflow = Math.max(0, textWidth - viewport);
    if (!active || reducedMotion || !viewport || overflow < 2) return;
    // Read from the beginning, then return from left to right at a steady speed.
    const animation = Animated.loop(Animated.sequence([
      Animated.delay(1400),
      Animated.timing(offset, { toValue: -overflow, duration: Math.max(2000, overflow * 32), easing: Easing.linear, useNativeDriver: true }),
      Animated.delay(1000),
      Animated.timing(offset, { toValue: 0, duration: Math.max(2000, overflow * 32), easing: Easing.linear, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [active, offset, reducedMotion, textWidth, title, viewport]);

  return (
    <View style={styles.clip} onLayout={event => setViewport(event.nativeEvent.layout.width)} accessible accessibilityLabel={title}>
      <ScrollView horizontal scrollEnabled={false} showsHorizontalScrollIndicator={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Animated.Text onLayout={event => setTextWidth(event.nativeEvent.layout.width)} numberOfLines={1}
          style={[styles.title, { color, transform: [{ translateX: offset }] }]}>{title}</Animated.Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden', height: 28 },
  title: { fontFamily: 'NunitoExtraBold', fontSize: 19, lineHeight: 28 },
});
