import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { DEFAULT_SYNC_OFFSET_MS, LOOKAHEAD_MS, effectiveLyricTimeMs, startNativeLyricClock } from './karaokeTiming';

export function useKaraokeClock(player, syncOffset = DEFAULT_SYNC_OFFSET_MS, previewPosition = null, fallbackCurrentTime = 0) {
  const currentTimeMs = useSharedValue(fallbackCurrentTime * 1000);
  const previewMs = useSharedValue(-1);
  const offsetMs = useSharedValue(typeof syncOffset === 'number' ? syncOffset : 0);

  useEffect(() => {
    if (typeof syncOffset === 'number') {
      offsetMs.value = syncOffset;
    }
  }, [syncOffset, offsetMs]);

  useEffect(() => {
    previewMs.value = previewPosition == null ? -1 : previewPosition * 1000;
  }, [previewPosition, previewMs]);

  useEffect(() => {
    if (!player && Number.isFinite(fallbackCurrentTime) && fallbackCurrentTime >= 0) {
      currentTimeMs.value = fallbackCurrentTime * 1000;
    }
  }, [fallbackCurrentTime, currentTimeMs, player]);

  useEffect(() => {
    let stop;
    const change = (state) => {
      stop?.();
      if (state === 'active' && player) {
        stop = startNativeLyricClock(player, (ms) => {
          currentTimeMs.value = ms;
        }, requestAnimationFrame, cancelAnimationFrame);
      }
    };
    change(AppState.currentState);
    const subscription = AppState.addEventListener('change', change);
    return () => { stop?.(); subscription.remove(); };
  }, [player, currentTimeMs]);

  const effectiveTimeMs = useDerivedValue(() => {
    'worklet';
    const pos = previewMs.value >= 0 ? previewMs.value : currentTimeMs.value;
    return effectiveLyricTimeMs(pos, offsetMs.value, LOOKAHEAD_MS);
  });

  return { currentTimeMs, effectiveTimeMs };
}
