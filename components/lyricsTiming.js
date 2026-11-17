// Positive compensation shows lyrics earlier; the audio clock is unchanged.
export const LYRICS_TIMING_KEY = 'music-player.lyrics-timing-seconds';

export function clampTimingOffset(seconds) {
  const value = Number(seconds);
  return Number.isFinite(value) ? Math.round(Math.max(-10, Math.min(10, value)) * 10) / 10 : 0;
}

export function adjustedLyricTime(seconds, offset) {
  return Math.max(0, seconds + clampTimingOffset(offset));
}

export function lyricSeekTime(seconds, offset) {
  return Math.max(0, seconds - clampTimingOffset(offset));
}
