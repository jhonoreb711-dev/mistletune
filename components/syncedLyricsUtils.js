export function activeSegmentIndex(segments, seconds) {
  'worklet';
  if (!Number.isFinite(seconds)) return -1;
  let low = 0;
  let high = segments.length - 1;
  let candidate = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (segments[mid].start <= seconds) { candidate = mid; low = mid + 1; }
    else high = mid - 1;
  }
  return candidate >= 0 && seconds < segments[candidate].end ? candidate : -1;
}

// Rendering only needs to change when a line or word starts/ends.
export function lyricBoundaries(segments) {
  return [...new Set([0, ...segments.flatMap((segment) => [
    segment.start, segment.end,
    ...(segment.words ?? []).flatMap((word) => [word.start, word.end]),
  ])])].filter(Number.isFinite).sort((a, b) => a - b);
}

export function lyricTimeAt(boundaries, seconds) {
  if (!Number.isFinite(seconds)) return 0;
  let low = 0;
  let high = boundaries.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (boundaries[mid] <= seconds) low = mid + 1;
    else high = mid - 1;
  }
  return boundaries[high] ?? 0;
}

export function importedSegments(lines, duration) {
  return lines.map((line, index) => ({ start: line.time, end: lines[index + 1]?.time ?? Math.max(duration, line.time + 1), text: line.text }));
}
