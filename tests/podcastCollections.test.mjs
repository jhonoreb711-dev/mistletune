import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
const source = await readFile(new URL('../components/podcastCollections.js', import.meta.url), 'utf8');
const { buildPodcastEpisodes, groupPodcastVideos } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('selection order defines numbering regardless of filenames and survives JSON storage', () => {
  const selected = [{ id: 'b', uri: 'file:///b.mp4', name: 'Z.mp4' }, { id: 'a', uri: 'file:///a.mp4', name: 'A.mp4' }];
  const episodes = buildPodcastEpisodes(selected, { id: 'series', title: ' My podcast ', description: ' My description ' });
  const [collection] = groupPodcastVideos(JSON.parse(JSON.stringify(episodes)));
  assert.equal(collection.title, 'My podcast');
  assert.equal(collection.description, 'My description');
  assert.deepEqual(collection.episodes.map((video) => [video.id, video.episodeNumber]), [['b', 1], ['a', 2]]);
  assert.equal(selected[0].episodeNumber, undefined);
});
test('removing a draft video before saving produces consecutive episode numbers', () => {
  const episodes = buildPodcastEpisodes([{ id: 'second', uri: 'file:///second.mp4' }], { id: 'series', title: 'Podcast', description: '' });
  assert.equal(episodes[0].episodeNumber, 1);
  assert.equal(episodes[0].uri, 'file:///second.mp4');
});
test('old videos remain accessible and identically named podcasts stay separate', () => {
  const groups = groupPodcastVideos([{ id: 'old', uri: 'file:///old.mp4', title: 'Old video' },
    ...buildPodcastEpisodes([{ id: 'one' }], { id: 'a', title: 'Same title' }),
    ...buildPodcastEpisodes([{ id: 'two' }], { id: 'b', title: 'Same title' })]);
  assert.equal(groups.length, 3);
  assert.equal(groups[0].title, 'Old video');
  assert.notEqual(groups[1].id, groups[2].id);
});
test('validation refuses empty titles and empty video selections', () => {
  assert.throws(() => buildPodcastEpisodes([{ id: 'a' }], { id: 'series', title: '  ' }), /title/);
  assert.throws(() => buildPodcastEpisodes([], { id: 'series', title: 'Podcast' }), /video/);
});

test('replacing a video preserves collection, description, cover and episode number without deleting the saved source', async () => {
  const serviceSource = (await readFile(new URL('../components/videoFileService.js', import.meta.url), 'utf8')).replace(/^import .*;\r?\n/gm, '').replaceAll('export ', '');
  const deleted = [];
  const FileSystem = { documentDirectory: 'file:///documents/', async getInfoAsync() { return { exists: true, size: 42 }; }, async copyAsync() {}, async deleteAsync(uri) { deleted.push(uri); } };
  const DocumentPicker = { async getDocumentAsync() { return { canceled: false, assets: [{ uri: 'content://new', name: 'new.mp4' }] }; } };
  const replace = new Function('FileSystem', 'DocumentPicker', `${serviceSource};return pickAndReplacePodcastVideo;`)(FileSystem, DocumentPicker);
  const previous = { id: 'one', uri: 'file:///old.mp4', name: 'old.mp4', title: 'A title', podcastId: 'series', podcastTitle: 'Series', podcastDescription: 'Description', episodeNumber: 2, coverUri: 'file:///cover.jpg' };
  const saved = await replace(previous);
  assert.equal(saved.podcastId, 'series');
  assert.equal(saved.podcastDescription, 'Description');
  assert.equal(saved.episodeNumber, 2);
  assert.equal(saved.coverUri, previous.coverUri);
  assert.notEqual(saved.uri, previous.uri);
  assert.deepEqual(deleted, []);
});
