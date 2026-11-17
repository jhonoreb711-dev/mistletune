import { AppState, Platform, TurboModuleRegistry } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { bundledWhisper } from '../assets/models';
import { offlineResourceFetcher, resolveBundledResource } from './bundledWhisper';
import { localAudioUri, monoChunk, MAX_LYRIC_AUDIO_SECONDS, TRANSCRIPTION_SAMPLE_RATE } from './transcriptionUtils';
import { lyricsCacheIdentity, readGeneratedLyrics, writeGeneratedLyrics } from './generatedLyricsCache';

let currentJob = null;
export function transcriptionAvailable() {
  return Platform.OS !== 'web' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient
    && Boolean(TurboModuleRegistry.get('ETInstaller') && TurboModuleRegistry.get('AudioAPIModule'));
}
export async function hasOfflineModel() { return Boolean(bundledWhisper); }
function cancelledError() { const error = new Error('Generation cancelled.'); error.code = 'CANCELLED'; return error; }

// First decoder step predicts a language token, entirely on device.
export async function detectWhisperLanguage(model, waveform, tokenizer) {
  const vocabulary = { ...tokenizer.model.vocab };
  for (const token of tokenizer.added_tokens) vocabulary[token.content] = token.id;
  const start = vocabulary['<|startoftranscript|>'];
  const languages = Object.entries(vocabulary).filter(([token]) => /^<\|[a-z]{2,3}\|>$/.test(token));
  if (!Number.isInteger(start) || !languages.length) throw new Error('The bundled tokenizer has no language tokens.');
  const encoded = await model.encode(waveform);
  // The shipped native decoder consumes uint64_t tokens despite its TS
  // declaration saying Int32Array. Supply one aligned 64-bit slot (length 1).
  const tokens = new Float64Array(1);
  new DataView(tokens.buffer).setUint32(0, start, true);
  const logits = await model.decode(tokens, encoded);
  let language;
  let score = -Infinity;
  for (const [token, id] of languages) {
    if (Number.isFinite(logits[id]) && logits[id] > score) { score = logits[id]; language = token.slice(2, -2); }
  }
  if (!language) throw new Error('Whisper could not identify the song language.');
  return language;
}
export function normalizeSegments(segments, offset, chunkDuration) {
  if (!Array.isArray(segments)) throw new Error('Whisper returned no timestamped result.');
  return segments.map((segment) => ({
    start: offset + Math.max(0, segment.start),
    end: offset + Math.min(chunkDuration, segment.end),
    text: (segment.text || segment.words?.map((word) => word.word).join('') || '').replace(/\s+/g, ' ').trim(),
  })).filter((segment) => segment.text && Number.isFinite(segment.start) && Number.isFinite(segment.end)
    && segment.end > segment.start).sort((a, b) => a.start - b.start);
}

// Imperative counterpart of useSpeechToText shares one serialized engine across
// playback and screens. v0.11 /legacy retains verbose timestamped output.
export function generateOfflineLyrics(track, { libraryId, onStage = () => {}, onProgress = () => {} } = {}) {
  const uri = localAudioUri(track?.source);
  const preceding = currentJob;
  preceding?.cancel();
  const job = { cancelled: false, cancel() { job.cancelled = true; } };
  currentJob = job;
  const check = () => { if (job.cancelled) throw cancelledError(); };
  const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') job.cancel(); });
  job.promise = (async () => {
    let model;
    let buffer;
    try {
      // Never unload native inference while a chunk is running.
      await preceding?.promise.catch(() => {});
      check();
      onStage('Checking saved lyrics');
      const cached = await readGeneratedLyrics(track, libraryId);
      check();
      if (cached) return cached;
      if (!transcriptionAvailable()) throw new Error('Offline generation requires a rebuilt MistleTunes APK, not Expo Go.');
      if (!bundledWhisper) throw new Error('Whisper is not bundled. Run npm run lyrics:models, then rebuild the app.');
      const identity = await lyricsCacheIdentity(track, libraryId);
      const info = await FileSystem.getInfoAsync(uri);
      if (info.size > 32 * 1024 * 1024) throw new Error('This file is too large for safe on-device decoding (32 MB maximum).');
      const { decodeAudioData, getAudioDuration } = require('react-native-audio-api');
      const seconds = await getAudioDuration(uri);
      check();
      if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('Could not read this song’s duration.');
      if (seconds > MAX_LYRIC_AUDIO_SECONDS) throw new Error('Offline lyrics supports songs up to 8 minutes to limit memory use.');
      onStage('Decoding local audio');
      // audio-api 1.0's standalone decoder replaces decodeAudioDataSource and
      // avoids touching the audio session used by expo-audio playback.
      buffer = await decodeAudioData(uri, TRANSCRIPTION_SAMPLE_RATE);
      check();
      if (buffer.duration > MAX_LYRIC_AUDIO_SECONDS || buffer.length > MAX_LYRIC_AUDIO_SECONDS * TRANSCRIPTION_SAMPLE_RATE) {
        throw new Error('Decoded audio exceeds the 8-minute memory limit.');
      }
      onStage('Loading bundled Whisper');
      const { initExecutorch, SpeechToTextModule } = require('react-native-executorch/legacy');
      initExecutorch({ resourceFetcher: offlineResourceFetcher });
      model = await SpeechToTextModule.fromModelName(bundledWhisper);
      check();
      const tokenizerPath = await resolveBundledResource(bundledWhisper.tokenizerSource);
      const tokenizer = JSON.parse(await FileSystem.readAsStringAsync(`file://${tokenizerPath}`));
      const chunkSize = 30 * TRANSCRIPTION_SAMPLE_RATE;
      const segments = [];
      let language;
      for (let start = 0; start < buffer.length; start += chunkSize) {
        check();
        const pcm = monoChunk(buffer, start, chunkSize);
        onStage('Generating offline lyrics…');
        language = await detectWhisperLanguage(model, pcm, tokenizer);
        check();
        const result = await model.transcribe(pcm, { language, verbose: true });
        check();
        segments.push(...normalizeSegments(result.segments, start / TRANSCRIPTION_SAMPLE_RATE, pcm.length / TRANSCRIPTION_SAMPLE_RATE));
        onProgress(Math.min(1, (start + pcm.length) / buffer.length));
      }
      for (let index = 0; index < segments.length - 1; index++) segments[index].end = Math.min(segments[index].end, segments[index + 1].start);
      const valid = segments.filter((segment) => segment.end > segment.start);
      check();
      onStage('Saving lyrics on this device');
      // Cache empty instrumentals too, so they do not transcribe on every play.
      return await writeGeneratedLyrics(identity, { segments: valid, duration: buffer.length / TRANSCRIPTION_SAMPLE_RATE, language });
    } catch (error) {
      if (job.cancelled) throw cancelledError();
      throw error;
    } finally {
      buffer = null;
      try { model?.delete(); }
      finally {
        subscription.remove();
        if (currentJob === job) currentJob = null;
      }
    }
  })();
  return job;
}
