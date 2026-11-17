import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';

const source = (await readFile(new URL('../components/batchTranscription.js', import.meta.url), 'utf8'))
  .replace(/^import .*;?\r?\n/gm, '')
  .replaceAll('export ', '');

function fixture({
  serverReachable = false,
  cachedIds = new Set(),
  timingVersion = 7,
  failIds = new Set(),
} = {}) {
  const transcribed = [];
  const progressCalls = [];

  const deps = {
    UNUSED_TIMING_VERSION: 7,
    getOfflineLyricsStatus: async () => ({ ready: serverReachable, message: 'Offline Whisper requires the rebuilt APK.' }),
    transcribeOffline: async (track, options) => {
      if (failIds.has(track.id)) throw new Error('Transcription error');
      options.onStage?.('Uploading...');
      options.onProgress?.(0.5);
      transcribed.push(track.id);
      return [{ start: 0, end: 1, text: 'Server Generated' }];
    },
    loadLyrics: async (_libraryId, _trackId) => null,
    readGeneratedLyrics: async (track, _libraryId) => {
      if (cachedIds.has(track.id)) return { timingVersion, segments: [{ start: 0, end: 1, text: 'Cached' }] };
      return null;
    },
  };

  const factory = new Function(
    'UNUSED_TIMING_VERSION',
    'getOfflineLyricsStatus',
    'transcribeOffline',
    'readGeneratedLyrics',
    'loadLyrics',
    `${source};return {batchTranscribeTracks};`
  );

  const service = factory(
    deps.UNUSED_TIMING_VERSION,
    deps.getOfflineLyricsStatus,
    deps.transcribeOffline,
    deps.readGeneratedLyrics,
    deps.loadLyrics,
  );

  return { service, transcribed, progressCalls };
}

test('batchTranscribeTracks processes all tracks with the offline engine, skips cached ones, and reports progress', async () => {
  const cachedIds = new Set(['track-2']);
  const { service, transcribed } = fixture({ serverReachable: true, cachedIds });

  const tracks = [
    { id: 'track-1', title: 'Song 1', source: 'file:///song1.mp3' },
    { id: 'track-2', title: 'Song 2', source: 'file:///song2.mp3' },
    { id: 'track-3', title: 'Song 3', source: 'file:///song3.mp3' },
  ];

  const progressEvents = [];
  const stats = await service.batchTranscribeTracks(tracks, 'lib-1', (ev) => progressEvents.push(ev));

  assert.deepEqual(transcribed, ['track-1', 'track-3']);
  assert.equal(stats.total, 3);
  assert.equal(stats.processed, 2);
  assert.equal(stats.skipped, 1);
  assert.equal(stats.errors, 0);
  assert.ok(progressEvents.length > 0);
});

test('batchTranscribeTracks continues on individual errors without aborting', async () => {
  const failIds = new Set(['track-2']);
  const { service, transcribed } = fixture({ serverReachable: true, failIds });

  const tracks = [
    { id: 'track-1', title: 'Song 1', source: 'file:///song1.mp3' },
    { id: 'track-2', title: 'Corrupt', source: 'file:///corrupt.mp3' },
    { id: 'track-3', title: 'Song 3', source: 'file:///song3.mp3' },
  ];

  const stats = await service.batchTranscribeTracks(tracks, 'lib-1');
  assert.deepEqual(transcribed, ['track-1', 'track-3']);
  assert.equal(stats.errors, 1);
  assert.equal(stats.processed, 2);
});

test('batchTranscribeTracks handles no engine gracefully with notice', async () => {
  const { service, transcribed } = fixture({ serverReachable: false });
  const tracks = [{ id: 'track-1', title: 'Song 1' }];
  let notice = null;

  const stats = await service.batchTranscribeTracks(tracks, 'lib-1', (ev) => {
    if (ev.stage === 'notice') notice = ev.message;
  });

  assert.equal(transcribed.length, 0);
  assert.equal(stats.skipped, 1);
  assert.ok(notice !== null);
});

test('unsupported builds explain that offline Whisper requires the rebuilt APK', async () => {
  const { service } = fixture();
  const result = await service.batchTranscribeTracks([{ id: 'song' }], 'lib');
  assert.equal(result.unavailable, true);
  assert.match(result.message, /requires the rebuilt APK/);
});

test('saved lyrics are reused offline without requiring a transcription engine', async () => {
  const { service, transcribed } = fixture({ serverReachable: false, cachedIds: new Set(['saved']) });
  const stats = await service.batchTranscribeTracks([{ id: 'saved' }], 'lib');
  assert.equal(stats.skipped, 1);
  assert.equal(stats.unavailable, undefined);
  assert.deepEqual(transcribed, []);
});
