import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
const source = await readFile(new URL('../components/syncedLyricsUtils.js', import.meta.url), 'utf8');
const { activeSegmentIndex, importedSegments } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const segments = [{ start: 2, end: 4, text: 'A' }, { start: 7, end: 10, text: 'B' }];
test('timestamp boundaries and instrumental gaps do not retain a stale highlighted line', () => {
  assert.equal(activeSegmentIndex(segments, 0), -1);
  assert.equal(activeSegmentIndex(segments, 2), 0);
  assert.equal(activeSegmentIndex(segments, 4), 0);
  assert.equal(activeSegmentIndex(segments, 5), -1);
  assert.equal(activeSegmentIndex(segments, 10.1), -1);
});
test('seeking backward or forward recomputes the active line without playback history', () => {
  assert.equal(activeSegmentIndex(segments, 9), 1);
  assert.equal(activeSegmentIndex(segments, 3), 0);
  assert.equal(activeSegmentIndex(segments, 8), 1);
  assert.equal(activeSegmentIndex([], 5), -1);
  assert.equal(activeSegmentIndex(segments, NaN), -1);
});
test('imported LRC keeps timestamps and uses track duration for the final line', () => {
  assert.deepEqual(importedSegments([{ time: 1, text: 'A' }, { time: 3, text: 'B' }], 7), [{ start: 1, end: 3, text: 'A' }, { start: 3, end: 7, text: 'B' }]);
});
