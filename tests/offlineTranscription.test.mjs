import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
const utilsSource = await readFile(new URL('../components/transcriptionUtils.js', import.meta.url), 'utf8');
const utils = await import(`data:text/javascript;base64,${Buffer.from(utilsSource).toString('base64')}`);
const serviceSource = (await readFile(new URL('../components/offlineTranscription.js', import.meta.url), 'utf8')).replace(/^import .*;\r?\n/gm, '').replaceAll('export ', '');
function fixture({ available = true, duration = 35, fail = false, cached = null, delay = null } = {}) {
  const calls = { loaded: 0, released: 0, decoded: 0, subscriptions: 0, transcribed: 0, saved: 0 };
  const audio = { duration, sampleRate: 16000, length: duration * 16000, numberOfChannels: 2, getChannelData() { return new Float32Array(this.length).fill(0.2); } };
  const tokenizer = { model: { vocab: { '<|startoftranscript|>': 0 } }, added_tokens: [{ id: 1, content: '<|en|>' }, { id: 2, content: '<|tl|>' }] };
  const model = {
    async encode(data) { assert(data instanceof Float32Array); return data; },
    async decode(tokens) {
      assert.equal(tokens.byteLength, 8); assert.equal(tokens.length, 1);
      assert.equal(new DataView(tokens.buffer).getUint32(0, true), 0);
      return new Float32Array([0, 1, 5]);
    },
    async transcribe(data, options) {
      calls.transcribed++;
      assert(data instanceof Float32Array);
      assert.equal(options.language, 'tl'); assert.equal(options.verbose, true);
      if (delay) await delay;
      if (fail) throw new Error('Native transcription failed');
      return { segments: [{ start: 0.1, end: 1, text: 'Test vocals' }] };
    },
    delete() { calls.released++; },
  };
  let onAppState;
  const deps = {
    ...utils,
    AppState: { addEventListener(_event, listener) { calls.subscriptions++; onAppState = listener; return { remove() { calls.subscriptions--; } }; } },
    Platform: { OS: 'android' }, TurboModuleRegistry: { get: () => available ? {} : null },
    Constants: { executionEnvironment: 'standalone' }, ExecutionEnvironment: { StoreClient: 'store' },
    bundledWhisper: { tokenizerSource: 1 }, offlineResourceFetcher: {}, resolveBundledResource: async () => '/tokenizer.bin',
    FileSystem: { async getInfoAsync() { return { size: 100 }; }, async readAsStringAsync() { return JSON.stringify(tokenizer); } },
    readGeneratedLyrics: async () => cached,
    lyricsCacheIdentity: async () => 'identity',
    writeGeneratedLyrics: async (identity, result) => { calls.saved++; assert.equal(identity, 'identity'); return result; },
    require(name) {
      if (name === 'react-native-executorch/legacy') return { initExecutorch() {}, SpeechToTextModule: { async fromModelName() { calls.loaded++; return model; } } };
      if (name === 'react-native-audio-api') return { getAudioDuration: async () => duration, decodeAudioData: async (_uri, rate) => { assert.equal(rate, 16000); calls.decoded++; return audio; } };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  };
  const factory = new Function(...Object.keys(deps), `${serviceSource};return {generateOfflineLyrics,transcriptionAvailable,normalizeSegments};`);
  return { service: factory(...Object.values(deps)), calls, background: () => onAppState('background') };
}
test('decodes local stereo to 16k mono, detects language, offsets native timestamps and saves before resolving', async () => {
  const { service, calls } = fixture();
  const result = await service.generateOfflineLyrics({ source: 'file:///song.mp3' }).promise;
  assert.deepEqual(result.segments, [{ start: 0.1, end: 1, text: 'Test vocals' }, { start: 30.1, end: 31, text: 'Test vocals' }]);
  assert.equal(calls.transcribed, 2); assert.equal(calls.saved, 1); assert.equal(calls.released, 1); assert.equal(calls.subscriptions, 0);
});
test('cache hit never initializes native engines, including when engines are unavailable', async () => {
  const cached = { segments: [] };
  const { service, calls } = fixture({ cached, available: false });
  assert.equal(await service.generateOfflineLyrics({ source: 'file:///song.mp3' }).promise, cached);
  assert.equal(calls.loaded, 0); assert.equal(calls.decoded, 0); assert.equal(calls.saved, 0);
});
test('rejects remote audio, missing native engines and long recordings without decoding', async () => {
  assert.throws(() => fixture().service.generateOfflineLyrics({ source: 'https://example.com/song.mp3' }), /local music file/);
  const unavailable = fixture({ available: false });
  await assert.rejects(unavailable.service.generateOfflineLyrics({ source: 'file:///song.mp3' }).promise, /Expo Go/);
  const long = fixture({ duration: 1000 });
  await assert.rejects(long.service.generateOfflineLyrics({ source: 'file:///song.mp3' }).promise, /8 minutes/);
  assert.equal(long.calls.decoded, 0);
});
test('cancellation and backgrounding never save partial transcripts', async () => {
  const { service, background, calls } = fixture();
  const task = service.generateOfflineLyrics({ source: 'file:///song.mp3' });
  background();
  await assert.rejects(task.promise, (error) => error.code === 'CANCELLED');
  assert.equal(calls.saved, 0); assert.equal(calls.subscriptions, 0);
  await service.generateOfflineLyrics({ source: 'file:///song.mp3' }).promise;
  assert.equal(calls.saved, 1);
});
test('new selections cancel and serialize older native work, releasing the model only after inference', async () => {
  let release;
  const delay = new Promise((resolve) => { release = resolve; });
  const { service, calls } = fixture({ delay });
  const first = service.generateOfflineLyrics({ source: 'file:///first.mp3' });
  const firstResult = assert.rejects(first.promise, (error) => error.code === 'CANCELLED');
  while (calls.transcribed === 0) await new Promise((resolve) => setImmediate(resolve));
  const second = service.generateOfflineLyrics({ source: 'file:///second.mp3' });
  assert.equal(calls.loaded, 1); assert.equal(calls.released, 0);
  release();
  await firstResult;
  await second.promise;
  assert.equal(calls.loaded, 2); assert.equal(calls.released, 2); assert.equal(calls.saved, 1);
});
test('failed inference releases native resources and leaves no cached result', async () => {
  const { service, calls } = fixture({ fail: true });
  await assert.rejects(service.generateOfflineLyrics({ source: 'file:///song.mp3' }).promise, /Native transcription failed/);
  assert.equal(calls.released, 1); assert.equal(calls.saved, 0); assert.equal(calls.subscriptions, 0);
});
test('mono conversion averages channels and timestamp normalization clips to the audio window', () => {
  const audio = { sampleRate: 16000, numberOfChannels: 2, length: 3, getChannelData(channel) { return channel ? new Float32Array([0, 0.5, 0]) : new Float32Array([1, 0.5, -1]); } };
  assert.deepEqual([...utils.monoChunk(audio, 0, 10)], [0.5, 0.5, -0.5]);
  const { service } = fixture();
  assert.deepEqual(service.normalizeSegments([{ start: -1, end: 20, text: ' A\nline ' }, { start: NaN, end: 2, text: 'bad' }], 30, 5), [{ start: 30, end: 35, text: 'A line' }]);
});

const resourceSource = (await readFile(new URL('../components/bundledWhisper.js', import.meta.url), 'utf8')).replace(/^import .*;\r?\n/gm, '').replaceAll('export ', '');
test('model adapter refuses HTTP/Metro sources before any asset download; embedded asset copies disable telemetry', async () => {
  let downloads = 0;
  let asset = { uri: 'http://localhost/model.pte', localUri: null, async downloadAsync() { downloads++; this.localUri = 'file:///model.pte'; } };
  const { resolveBundledResource, offlineResourceFetcher } = new Function('Asset', 'FileSystem', `${resourceSource};return {resolveBundledResource,offlineResourceFetcher};`)({ fromModule: () => asset }, {});
  await assert.rejects(resolveBundledResource('https://example.com/model.pte'), /remote/);
  await assert.rejects(resolveBundledResource(1), /Metro/);
  asset = { ...asset, uri: 'ftp://example.com/model.pte' };
  await assert.rejects(resolveBundledResource(1), /Metro/);
  asset = { ...asset, uri: '//example.com/model.pte' };
  await assert.rejects(resolveBundledResource(1), /Metro/);
  assert.equal(downloads, 0);
  asset = { ...asset, uri: 'asset:///bundled.pte' };
  assert.deepEqual(await offlineResourceFetcher.fetch(undefined, 1), { paths: ['/model.pte'], wasDownloaded: [false] });
  assert.equal(downloads, 1);
});
