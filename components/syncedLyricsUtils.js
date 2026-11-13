export function activeSegmentIndex(segments, seconds) {
  if (!Number.isFinite(seconds)) return -1;
  let low = 0;
  let high = segments.length - 1;
  let candidate = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (segments[mid].start <= seconds) { candidate = mid; low = mid + 1; }
    else high = mid - 1;
  }
  return candidate >= 0 && seconds <= segments[candidate].end ? candidate : -1;
}

export function importedSegments(lines, duration) {
  return lines.map((line, index) => ({ start: line.time, end: lines[index + 1]?.time ?? Math.max(duration, line.time + 1), text: line.text }));
}
