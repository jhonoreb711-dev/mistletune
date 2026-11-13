export function parseLyrics(text) {
  const raw = String(text || '').replace(/^\uFEFF/, '').replace(/\r/g, '');
  const offset = Number(raw.match(/\[offset:\s*(-?\d+)\]/i)?.[1] || 0) / 1000;
  const timed = [];
  for (const line of raw.split('\n')) {
    const tags = [...line.matchAll(/\[(\d+):([0-5]?\d)(?:[.:](\d{1,3}))?\]/g)];
    const content = line.replace(/\[[^\]]*\]/g, '').trim();
    for (const tag of tags) timed.push({ time: Math.max(0, Number(tag[1]) * 60 + Number(tag[2]) + Number(`0.${tag[3] || 0}`) + offset), text: content || '♪' });
  }
  if (timed.length) return { synced: true, lines: timed.sort((a, b) => a.time - b.time) };
  return { synced: false, lines: raw.split('\n').filter((line) => !/^\s*\[[a-z]+:.*\]\s*$/i.test(line)).map((line) => ({ time: null, text: line.trim() })).filter((line) => line.text) };
}

export function activeLyricIndex(lines, time) {
  let low = 0;
  let high = lines.length - 1;
  let result = -1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (lines[middle].time <= time) { result = middle; low = middle + 1; }
    else high = middle - 1;
  }
  return result;
}
