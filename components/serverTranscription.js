/**
 * serverTranscription.js
 * Sends audio to the local lyrics transcription server (Groq whisper-large-v3 + LRCLIB).
 */
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { writeGeneratedLyrics, lyricsCacheIdentity } from './generatedLyricsCache';

// ─── CONFIG ────────────────────────────────────────────────────────────────────
// The lyrics server runs on the computer hosting Expo and the local lyrics service.
const metroHost = Constants.expoConfig?.hostUri?.split(':')[0];
// Keep installed builds on the same home Wi-Fi working too; update this LAN
// address if the computer running server.py receives a different address.
export const SERVER_URL = `http://${metroHost || '192.168.1.242'}:5001`;
export const MAX_DURATION_MINUTES = 10;
export const TIMING_VERSION = 7;
const pendingTranscriptions = new Map();
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Check if the configured transcription API is reachable.
 */
export async function getServerStatus(timeoutMs = 3000) {
  if (!SERVER_URL) return { ready: false, message: 'No lyrics server address is configured.' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${SERVER_URL}/ping`, { signal: controller.signal });
    if (!response.ok) throw new Error('Health check failed');
    const server = await response.json();
    if (server.timingVersion !== TIMING_VERSION) return { ready: false, message: 'The lyrics server is connected but outdated. Restart python server.py using the current project files.' };
    if (server.ready === false) return { ready: false, message: 'The lyrics server is connected, but its Groq API key is missing. Add groq_api_key to server/config.json (see server/config.json.example), or set GROQ_API_KEY, then restart python server.py.' };
    return { ready: true };
  } catch {
    return { ready: false, message: `Could not connect to ${SERVER_URL}. Start python server.py and connect both devices to the same Wi-Fi.` };
  } finally {
    clearTimeout(timer);
  }
}

export async function isServerReachable(timeoutMs = 3000) {
  return (await getServerStatus(timeoutMs)).ready;
}

/**
 * Transcribe a single track using the lyrics server.
 * Returns the segments array or null if failed.
 *
 * @param {Object} track - Track object with .uri, .title, .duration
 * @param {Object} options
 * @param {string} options.libraryId
 * @param {Function} [options.onStage]
 * @param {Function} [options.onProgress]
 * @returns {Promise<Array|null>}
 */
export function transcribeViaServer(track, options = {}) {
  const key = JSON.stringify([options.libraryId, track.id, track.uri || track.source]);
  if (pendingTranscriptions.has(key)) return pendingTranscriptions.get(key);
  const pending = transcribeRecording(track, options).finally(() => pendingTranscriptions.delete(key));
  pendingTranscriptions.set(key, pending);
  return pending;
}

async function transcribeRecording(track, { libraryId, onStage, onProgress, force = false } = {}) {
  const title = track.title || track.name || 'Unknown';
  if (!SERVER_URL) {
    throw new Error('The lyrics server is unavailable. Start it with server/start-server.bat.');
  }

  const status = await getServerStatus(5000);
  if (!status.ready) throw Object.assign(new Error(status.message), { code: 'SERVER_UNAVAILABLE' });

  // Check duration limit (10 min)
  if (track.duration && track.duration > MAX_DURATION_MINUTES * 60) {
    throw Object.assign(
      new Error(`"${title}" is longer than ${MAX_DURATION_MINUTES} minutes and was skipped.`),
      { code: 'TOO_LONG' }
    );
  }

  onStage?.('Sending audio...');
  onProgress?.(0.05);

  const audioUri = track.uri || track.source?.uri || track.source;
  if (!audioUri) throw new Error(`Could not read audio file for "${title}"`);

  let uploadResult;
  try {
    uploadResult = await FileSystem.uploadAsync(
      `${SERVER_URL}/transcribe`,
      audioUri,
      {
        fieldName: 'audio',
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        mimeType: 'audio/mpeg',
        parameters: {
          title: String(track.title || track.name || ''),
          artist: String(track.artist || ''),
          duration: String(track.duration || 0),
          timing: force ? 'audio' : 'auto',
        },
      }
    );
  } catch (err) {
    throw new Error(`Could not send audio to the lyrics service: ${err.message || err}`);
  }

  onProgress?.(0.5);

  if (uploadResult.status === 413) {
    throw Object.assign(new Error(`"${title}" is longer than 10 minutes.`), { code: 'TOO_LONG' });
  }
  if (uploadResult.status < 200 || uploadResult.status >= 300) {
    let errorMsg = 'The lyrics service could not prepare lyrics';
    try {
      const parsed = JSON.parse(uploadResult.body);
      if (parsed.error) errorMsg = parsed.error;
    } catch {}
    throw new Error(errorMsg);
  }

  let data;
  try {
    data = JSON.parse(uploadResult.body);
  } catch {
    throw new Error('The lyrics service returned an invalid response.');
  }
  onProgress?.(0.9);
  onStage?.('Saving lyrics...');

  if (data.timingVersion !== TIMING_VERSION) {
    throw new Error('The lyrics server returned outdated timing data. Restart python server.py.');
  }

  const identity = await lyricsCacheIdentity(track, libraryId);

  if (!Array.isArray(data.segments) || data.segments.length === 0) {
    // Instrumental / silent track — cache as empty so we don't retry
    const emptyResult = { segments: [], language: data.language || 'unknown', source: data.source || 'server', timingVersion: data.timingVersion, alignment: data.alignment };
    await writeGeneratedLyrics(identity, emptyResult, track.id, libraryId);
    onProgress?.(1);
    return [];
  }

  const result = { segments: data.segments, language: data.language, source: data.source || 'server', timingVersion: data.timingVersion, alignment: data.alignment };
  await writeGeneratedLyrics(identity, result, track.id, libraryId);
  onProgress?.(1);
  return data.segments;
}
