import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
const source = (await readFile(new URL('../components/offlineLyrics.js', import.meta.url), 'utf8')).replace(/^import .*;\r?\n/gm, '').replaceAll('export ', '');
const segmentSource = await readFile(new URL('../components/offlineLyricsSegments.js', import.meta.url), 'utf8');
const { appendOfflineSegments } = await import('data:text/javascript,' + encodeURIComponent(segmentSource));
function fixture({ expoGo = false, cached = null, remote = false, failDecode = false } = {}) {
  const events = []; const writes = []; let active = 0; let maxActive = 0;
  const FileSystem = { documentDirectory: 'file:///docs/', getInfoAsync: async () => ({ exists: true, size: 100 }), makeDirectoryAsync: async () => {}, copyAsync: async () => events.push('copy'), moveAsync: async () => {}, deleteAsync: async () => {}, readAsStringAsync: async () => '{}' };
  const Asset = { fromModule: () => ({ name: 'model', hash: 'model', type: 'pte', uri: remote ? 'https://not-allowed/model.pte' : 'file:///bundled/model.pte' }) };
  const require = (name) => {
    events.push(name);
    if (name.includes('assets/models/')) return 42;
    if (name === 'react-native-executorch') return { initExecutorch() {}, SpeechToTextModule: { fromModelName: async () => {
      active++; maxActive = Math.max(maxActive, active);
      return { transcribe: async () => ({ text: 'Hello', language: 'en', segments: [{ start: 0, end: 1, text: 'Hello', words: [{ word: 'Hello', start: 0, end: 1 }] }] }), delete() { active--; events.push('unload'); } };
    } } };
    if (name === 'react-native-audio-api') return { OfflineAudioContext: class { async decodeAudioData(uri) { events.push(uri); if (failDecode) throw new Error('Decoder failed'); return { length: 32000, duration: 2, sampleRate: 16000 }; } } };
    throw Error('Unexpected native import: ' + name);
  };
  const factory = new Function('Constants', 'ExecutionEnvironment', 'Platform', 'Asset', 'FileSystem', 'readGeneratedLyrics', 'writeGeneratedLyrics', 'lyricsCacheIdentity', 'localAudioUri', 'monoChunk', 'MAX_LYRIC_AUDIO_SECONDS', 'TRANSCRIPTION_SAMPLE_RATE', 'appendOfflineSegments', 'require', source + '; return { transcribeOffline, getOfflineLyricsStatus, offlineModelFetcher };');
  const service = factory({ executionEnvironment: expoGo ? 'store' : 'standalone' }, { StoreClient: 'store' }, { OS: 'android' }, Asset, FileSystem, async () => cached,
    async (...args) => { writes.push(args); }, async () => 'identity', (uri) => { if (!uri.startsWith('file://')) throw Error('Local files only'); return uri; }, () => new Float32Array(32000), 480, 16000, appendOfflineSegments, require);
  return { service, events, writes, maxActive: () => maxActive, FileSystem };
}
const track = { id: 'song', source: 'file:///song.mp3', duration: 2 };
test('Expo Go never loads native libraries or uploads audio', async () => {
  const { service, events, writes } = fixture({ expoGo: true });
  await assert.rejects(service.transcribeOffline(track, { libraryId: 'lib' }), /Expo Go/);
  assert.deepEqual(events, []); assert.deepEqual(writes, []);
});
test('cached lyrics need neither native modules nor connectivity', async () => {
  const segments = [{ start: 0, end: 1, text: 'Saved' }];
  const { service, events } = fixture({ expoGo: true, cached: { segments } });
  assert.deepEqual(await service.transcribeOffline(track), segments); assert.deepEqual(events, []);
});
test('native jobs share duplicate work, serialize models, save timestamps, and release models', async () => {
  const { service, events, writes, maxActive } = fixture();
  const first = service.transcribeOffline(track, { libraryId: 'lib' });
  assert.equal(first, service.transcribeOffline(track, { libraryId: 'lib' }));
  await Promise.all([first, service.transcribeOffline({ ...track, id: 'other' }, { libraryId: 'lib' })]);
  assert.equal(maxActive(), 1); assert.equal(writes.length, 2);
  assert.equal(writes[0][1].segments[0].words[0].start, 0);
  assert.match(writes[0][1].source, /offline-whisper/);
  assert.equal(events.filter((event) => event === 'unload').length, 2);
});
test('decoder failure releases the model and never writes a partial transcript', async () => {
  const { service, events, writes } = fixture({ failDecode: true });
  await assert.rejects(service.transcribeOffline(track), /Decoder failed/);
  assert.ok(events.includes('unload')); assert.deepEqual(writes, []);
});
test('offline model adapter refuses remote and non-bundled sources', async () => {
  const { service, FileSystem, events } = fixture({ remote: true });
  FileSystem.getInfoAsync = async () => ({ exists: false });
  await assert.rejects(service.offlineModelFetcher.fetch(null, 'https://example.com/model.pte'), /only accepts/);
  await assert.rejects(service.offlineModelFetcher.fetch(null, 42), /not embedded/);
  assert.deepEqual(events, []);
});
test('song size limits and cancellation prevent native loading', async () => {
  const { service, events } = fixture();
  await assert.rejects(service.transcribeOffline({ ...track, duration: 500 }), { code: 'TOO_LONG' });
  await assert.rejects(service.transcribeOffline(track, { cancelToken: { cancelled: true } }), { code: 'CANCELLED' });
  assert.deepEqual(events, []);
});
test('chunk offsets preserve acoustic timing and remove invalid or overlapping segments', () => {
  const output = [{ start: 0, end: 1, text: 'First' }];
  appendOfflineSegments(output, { segments: [{ start: 0, end: 2, text: '  Next  line ', words: [{ word: 'Next', start: 0, end: 0.5 }] }, { start: 1, end: 3, text: 'Overlap' }, { start: 3, end: 3, text: 'Invalid' }] }, 28, 4);
  assert.deepEqual(output.map(({ start, end }) => [start, end]), [[0, 1], [28, 30], [30, 31]]);
  assert.equal(output[1].words[0].start, 28); assert.equal(output[1].text, 'Next line');
});
test('active lyrics entry points do not import the server transcription service', async () => {
  for (const name of ['batchTranscription.js', 'LyricsScreen.jsx', 'offlineLyrics.js']) {
    const contents = await readFile(new URL('../components/' + name, import.meta.url), 'utf8');
    assert.doesNotMatch(contents, /serverTranscription|uploadAsync|fetch\s*\(\s*['"`]https?:/);
  }
});
