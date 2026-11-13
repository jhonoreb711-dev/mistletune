import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
const source = (await readFile(new URL('../components/generatedLyricsCache.js', import.meta.url), 'utf8')).replace(/^import .*;\r?\n/gm, '').replaceAll('export ', '');
function fixture() {
  const disk = new Map();
  const track = { id: 'one', source: 'file:///song.mp3' };
  let modified = 1;
  const FileSystem = {
    documentDirectory: 'file:///documents/',
    async getInfoAsync(uri) { return uri === track.source ? { exists: true, size: 100, modificationTime: modified } : { exists: disk.has(uri) }; },
    async readAsStringAsync(uri) { return disk.get(uri); },
    async writeAsStringAsync(uri, text) { disk.set(uri, text); },
    async makeDirectoryAsync() {},
    async deleteAsync(uri) { disk.delete(uri); },
    async moveAsync({ from, to }) { disk.set(to, disk.get(from)); disk.delete(from); },
  };
  const factory = new Function('FileSystem', 'localAudioUri', 'bundledWhisper', `${source};return {lyricsCacheIdentity,readGeneratedLyrics,writeGeneratedLyrics,deleteGeneratedLyrics,validSegments};`);
  const cache = factory(FileSystem, (uri) => uri, { version: 'test-model' });
  return { disk, track, cache, modify() { modified++; } };
}
test('persistent JSON roundtrip includes end times and isolates library/model/file identity', async () => {
  const { cache, track, disk, modify } = fixture();
  const identity = await cache.lyricsCacheIdentity(track, 'library-a');
  assert.equal(await cache.readGeneratedLyrics(track, 'library-a'), null);
  await cache.writeGeneratedLyrics(identity, { segments: [{ start: 1, end: 2.5, text: 'A' }] });
  assert.equal((await cache.readGeneratedLyrics(track, 'library-a')).segments[0].end, 2.5);
  assert.equal(await cache.readGeneratedLyrics(track, 'library-b'), null);
  assert.equal([...disk.keys()].some((key) => key.endsWith('.part')), false);
  modify();
  assert.equal(await cache.readGeneratedLyrics(track, 'library-a'), null);
});
test('empty instrumentals are cached; corrupt or overlapping transcripts are rejected', async () => {
  const { cache, track, disk } = fixture();
  const identity = await cache.lyricsCacheIdentity(track, 'library');
  await cache.writeGeneratedLyrics(identity, { segments: [] });
  assert.deepEqual((await cache.readGeneratedLyrics(track, 'library')).segments, []);
  const path = [...disk.keys()][0];
  disk.set(path, 'broken json');
  assert.equal(await cache.readGeneratedLyrics(track, 'library'), null);
  await assert.rejects(cache.writeGeneratedLyrics(identity, { segments: [{ start: 1, end: 3, text: 'A' }, { start: 2, end: 4, text: 'B' }] }), /invalid/);
  await cache.deleteGeneratedLyrics(track, 'library');
  assert.equal(disk.size, 0);
});
