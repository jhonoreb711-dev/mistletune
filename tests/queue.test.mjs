import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../components/queueUtils.js', import.meta.url), 'utf8');
const { swipeRemovalDirection, appendQueueTrack, availableQueueTracks, queueAfterRemoval } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const a = { id: 'a', title: 'First', artist: 'Artist One', source: 'a.mp3' };
const b = { id: 'b', title: 'Second', artist: 'Artist Two', source: 'b.mp3' };
const c = { id: 'c', title: 'Third', source: 'c.mp3' };

test('swipes dismiss in either direction on small and large screens', () => {
  for (const width of [320, 375, 800]) {
    assert.equal(swipeRemovalDirection(-100, 0, width), -1);
    assert.equal(swipeRemovalDirection(100, 0, width), 1);
    assert.equal(swipeRemovalDirection(3, 900, width), 0);
    assert.equal(swipeRemovalDirection(30, 0, width), 0);
  }
});

test('short flicks dismiss, but reversing a short swipe cancels removal', () => {
  assert.equal(swipeRemovalDirection(-25, -800, 375), -1);
  assert.equal(swipeRemovalDirection(25, 800, 375), 1);
  assert.equal(swipeRemovalDirection(25, -800, 375), 0);
  assert.equal(swipeRemovalDirection(-25, 800, 375), 0);
});

test('adding appends without mutating the queue or adding duplicates', () => {
  const queue = [a];
  assert.deepEqual(appendQueueTrack(queue, b), [a, b]);
  assert.deepEqual(queue, [a]);
  assert.equal(appendQueueTrack(queue, a), queue);
  assert.equal(appendQueueTrack(queue, { id: 'bad' }), queue);
  assert.deepEqual(appendQueueTrack([], b), [b]);
});

test('picker excludes queued and unplayable songs and searches title or artist', () => {
  const library = [a, b, c, { id: 'missing', title: 'Missing' }];
  assert.deepEqual(availableQueueTracks(library, [a]), [b, c]);
  assert.deepEqual(availableQueueTracks(library, [a], ' ARTIST TWO '), [b]);
  assert.deepEqual(availableQueueTracks(library, [a], 'third'), [c]);
  assert.deepEqual(availableQueueTracks(library, [a, b, c]), []);
});

test('removing a queued song keeps current playback; removing current advances', () => {
  const queue = [a, b, c];
  assert.deepEqual(queueAfterRemoval(queue, 'a', 'b'), { tracks: [b, c], nextTrack: undefined });
  assert.deepEqual(queueAfterRemoval(queue, 'b', 'b'), { tracks: [a, c], nextTrack: c });
  assert.deepEqual(queueAfterRemoval(queue, 'c', 'c'), { tracks: [a, b], nextTrack: a });
  assert.deepEqual(queueAfterRemoval([a], 'a', 'a'), { tracks: [], nextTrack: null });
  assert.equal(queueAfterRemoval(queue, 'missing', 'b').tracks, queue);
  assert.deepEqual(queue, [a, b, c]);
});
