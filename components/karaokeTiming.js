// All animation calculations use milliseconds. Server/cache timestamps remain seconds.
export const DEFAULT_SYNC_OFFSET_MS = -150;
export const LOOKAHEAD_MS = 50;

export function visibleLyricLine(segments, timeMs) {
  'worklet';
  let low = 0;
  let high = segments.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (segments[mid].start * 1000 <= timeMs) low = mid + 1;
    else high = mid - 1;
  }
  return Math.max(0, high);
}

export function clampSyncOffset(ms) {
  const value = Number(ms);
  return Number.isFinite(value) ? Math.round(Math.max(-5000, Math.min(5000, value)) / 50) * 50 : DEFAULT_SYNC_OFFSET_MS;
}

// Negative offsets move the visual earlier. Do not add this to the audio position.
export function effectiveLyricTimeMs(positionMs, offsetMs, lookaheadMs) {
  'worklet';
  const lookahead = typeof lookaheadMs === 'number' ? lookaheadMs : 50;
  return positionMs - offsetMs + lookahead;
}

export function wordSweepProgress(timeMs, startMs, endMs) {
  'worklet';
  if (endMs <= startMs) return 0;
  return Math.max(0, Math.min(1, (timeMs - startMs) / (endMs - startMs)));
}

export function lyricTapPositionMs(startMs, offsetMs, lookaheadMs) {
  const lookahead = typeof lookaheadMs === 'number' ? lookaheadMs : 50;
  return Math.max(0, startMs + offsetMs - lookahead);
}

// Injectable frame scheduler makes pause, stall, seek and cleanup testable.
export function startNativeLyricClock(player, publish, requestFrame, cancelFrame) {
  let frame;
  let stopped = false;
  const sample = () => {
    if (stopped) return;
    try {
      const seconds = player.currentTime;
      if (Number.isFinite(seconds)) publish(Math.max(0, seconds * 1000));
    } catch { /* Released native player: retain the last known position. */ }
    frame = requestFrame(sample);
  };
  sample();
  return () => { stopped = true; cancelFrame(frame); };
}
