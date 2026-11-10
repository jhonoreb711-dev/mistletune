import { useState } from 'react';
import { Animated, Pressable } from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function PressableScale({ style, scaleTo = 0.95, onPressIn, onPressOut, children, ...rest }) {
  const [scale] = useState(() => new Animated.Value(1));

  const springTo = (toValue) =>
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 40, bounciness: 8 }).start();

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(event) => { springTo(scaleTo); onPressIn?.(event); }}
      onPressOut={(event) => { springTo(1); onPressOut?.(event); }}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}