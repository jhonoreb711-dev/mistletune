// Preserve acoustic timestamps; never spread text evenly across a song.
export function appendOfflineSegments(output, result, offset, duration) {
  for (const segment of result?.segments || []) {
    const text = segment.text?.replace(/\s+/g, ' ').trim();
    if (!text || !Number.isFinite(segment.start) || !Number.isFinite(segment.end)) continue;
    const start = Math.max(offset, offset + segment.start, output.at(-1)?.end || 0);
    const end = Math.min(offset + duration, offset + segment.end);
    if (end <= start) continue;
    const words = (segment.words || []).filter((word) => typeof word.word === 'string' && Number.isFinite(word.start) && Number.isFinite(word.end))
      .map((word) => ({ word: word.word, start: Math.max(start, offset + word.start), end: Math.min(end, offset + word.end) }))
      .filter((word) => word.end > word.start);
    output.push({ start, end, text, ...(words.length ? { words } : {}) });
  }
  return output;
}
