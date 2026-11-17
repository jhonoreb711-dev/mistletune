import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';
const source = await readFile(new URL('../components/podcastCollections.js', import.meta.url), 'utf8');
const { buildPodcastEpisodes, groupPodcastVideos, getPodcastEpisodePreview } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const videos = buildPodcastEpisodes(Array.from({ length: 5 }, (_, index) => ({ id: `episode-${index + 1}`, uri: `file:///episode-${index + 1}.mp4`, name: `file-${index + 1}.mp4` })), { id: 'show-one', title: 'Title 1', description: 'Description 1' });

test('horizontal preview keeps the first three uploads and leaves all five available to See all', () => {
  const [show] = groupPodcastVideos(JSON.parse(JSON.stringify(videos)));
  const before = JSON.stringify(show);
  const preview = getPodcastEpisodePreview(show);
  assert.deepEqual(preview.map((episode) => episode.episodeNumber), [1, 2, 3]);
  assert.equal(show.episodes.length, 5);
  assert.notEqual(preview, show.episodes);
  assert.equal(JSON.stringify(show), before);
});
test('creating another title adds a separate section below existing shows and preserves every episode after reload', () => {
  const next = buildPodcastEpisodes([{ id: 'new-episode', uri: 'file:///new.mp4' }], { id: 'show-two', title: 'Title 2', description: 'Description 2' });
  const shows = groupPodcastVideos(JSON.parse(JSON.stringify([...videos, ...next])));
  assert.deepEqual(shows.map((show) => show.title), ['Title 1', 'Title 2']);
  assert.equal(shows[0].episodes.length, 5);
  assert.equal(shows[1].episodes[0].episodeNumber, 1);
  assert.equal(shows[0].description, 'Description 1');
  assert.equal(shows[1].description, 'Description 2');
});

const storageSource = (await readFile(new URL('../components/podcastVideoStorage.js', import.meta.url), 'utf8')).replace(/^import .*;\r?\n/gm, '').replaceAll('export ', '');
function storageFixture({ raw = JSON.stringify(videos), failSave = false } = {}) {
  let saved = raw;
  const events = [];
  const AsyncStorage = {
    async getItem() { return saved; },
    async setItem(_key, value) { if (failSave) throw new Error('Disk full'); saved = value; events.push('saved'); },
  };
  const remove = new Function('AsyncStorage', 'deleteVideoFile', `${storageSource}; return removePodcastEpisode;`)(AsyncStorage, async (uri) => events.push(uri));
  return { remove, events, snapshot: () => saved };
}
test('confirmed deletion persists only the chosen episode and saves before deleting the file', async () => {
  const fixture = storageFixture();
  const updated = await fixture.remove('episode-2');
  assert.deepEqual(updated.map((episode) => episode.episodeNumber), [1, 3, 4, 5]);
  assert.equal(JSON.parse(fixture.snapshot()).length, 4);
  assert.deepEqual(fixture.events, ['saved', 'file:///episode-2.mp4']);
});
test('save failure and corrupt storage cannot delete files or overwrite the library', async () => {
  const failed = storageFixture({ failSave: true });
  await assert.rejects(failed.remove('episode-1'), /Disk full/);
  assert.equal(JSON.parse(failed.snapshot()).length, 5);
  assert.deepEqual(failed.events, []);
  const corrupt = storageFixture({ raw: 'broken json' });
  await assert.rejects(corrupt.remove('episode-1'));
  assert.equal(corrupt.snapshot(), 'broken json');
  assert.deepEqual(corrupt.events, []);
});
test('removing one episode does not remove shared files or episodes in another show', async () => {
  const a = { ...videos[0], coverUri: 'file:///cover.jpg' };
  const b = { ...videos[1], uri: a.uri, coverUri: a.coverUri, podcastId: 'another-show' };
  const fixture = storageFixture({ raw: JSON.stringify([a, b]) });
  const updated = await fixture.remove(a.id);
  assert.equal(updated[0].podcastId, 'another-show');
  assert.deepEqual(fixture.events, ['saved']);
});

const backgroundSource = (await readFile(new URL('../components/podcastBackgrounds.js', import.meta.url), 'utf8')).replaceAll('export ', '');
const backgroundFiles = [];
const getPodcastBackground = new Function('require', `${backgroundSource};return getPodcastBackground;`)((file) => { backgroundFiles.push(file); return file; });
test('podcast artwork uses podcast then album then background assets and never a Home MP4', async () => {
  assert.match(getPodcastBackground({ id: 'rainy', assets: { homeVideo: 99 } }), /rain_podcast\.gif$/);
  assert.match(getPodcastBackground({ id: 'summer', assets: { homeVideo: 99 } }), /summer_podcast\.gif$/);
  assert.match(getPodcastBackground({ id: 'valentines', assets: { homeVideo: 99 } }), /valentines_album\.gif$/);
  assert.match(getPodcastBackground({ id: 'newyear', assets: { homeVideo: 99 } }), /newyear_Background\.gif$/);
  assert.match(getPodcastBackground({ id: 'halloween', assets: { homeVideo: 99 } }), /Halloween_background\.gif$/);
  assert.equal(getPodcastBackground({ id: 'custom', assets: { podcast: 'podcast.gif', album: 'album.gif', background: '_background.gif', homeVideo: 99 } }), 'podcast.gif');
  assert.equal(getPodcastBackground({ id: 'custom', assets: { album: 'album.gif', background: '_background.gif', homeVideo: 99 } }), 'album.gif');
  assert.equal(getPodcastBackground({ id: 'custom', assets: { background: '_background.gif', homeVideo: 99 } }), '_background.gif');
  assert.equal(getPodcastBackground({ id: 'custom', assets: { homeVideo: 99 } }), null);
  const components = fileURLToPath(new URL('../components/', import.meta.url));
  for (const file of backgroundFiles) assert((await stat(path.resolve(components, file))).size > 0);
});
