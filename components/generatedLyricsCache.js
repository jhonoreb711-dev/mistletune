import * as FileSystem from 'expo-file-system/legacy';
import { localAudioUri } from './transcriptionUtils';

const LYRICS_MODEL_VERSION = 'groq-whisper-large-v3-karaoke-v5';

const directory = () => `${FileSystem.documentDirectory}GeneratedLyrics/v3/`;
const memoryCache = new Map();

export function getInMemoryLyrics(libraryId, trackId) {
  if (!libraryId || !trackId) return null;
  return memoryCache.get(`${libraryId}:${trackId}`)?.data || null;
}

export function cacheInMemory(libraryId, trackId, identity, lyrics) {
  if (!libraryId || !trackId || !lyrics) return;
  memoryCache.set(`${libraryId}:${trackId}`, { identity, data: lyrics });
}

export function clearInMemoryLyrics(libraryId, trackId) {
  if (libraryId && trackId) {
    memoryCache.delete(`${libraryId}:${trackId}`);
  } else {
    memoryCache.clear();
  }
}

export async function clearAllGeneratedLyrics() {
  clearInMemoryLyrics();
  try {
    await FileSystem.deleteAsync(directory(), { idempotent: true });
  } catch {}
}

export function cacheHash(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16);
}
export function validSegments(segments) {
  return Array.isArray(segments) && segments.every((segment, index) =>
    Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.start >= 0
    && segment.end > segment.start && typeof segment.text === 'string' && segment.text.trim()
    && (index === 0 || segment.start >= segments[index - 1].end));
}
export async function lyricsCacheIdentity(track, libraryId) {
  const uri = localAudioUri(track?.source);
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || info.isDirectory) throw new Error('The local song file is no longer available.');
  return JSON.stringify({ libraryId, id: track.id, uri, size: info.size, modified: info.modificationTime, model: LYRICS_MODEL_VERSION });
}
export async function readGeneratedLyrics(track, libraryId) {
  const identity = await lyricsCacheIdentity(track, libraryId);
  const path = `${directory()}${cacheHash(identity)}.json`;
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    clearInMemoryLyrics(libraryId, track?.id);
    return null;
  }
  try {
    const saved = JSON.parse(await FileSystem.readAsStringAsync(path));
    if (saved.identity !== identity || saved.schema !== 3 || !validSegments(saved.segments)) {
      clearInMemoryLyrics(libraryId, track?.id);
      return null;
    }
    cacheInMemory(libraryId, track?.id, identity, saved);
    return saved;
  } catch {
    clearInMemoryLyrics(libraryId, track?.id);
    return null;
  }
}
export async function writeGeneratedLyrics(identity, result, trackId = null, libraryId = null) {
  if (!validSegments(result.segments)) throw new Error('The generated timestamps are invalid.');
  await FileSystem.makeDirectoryAsync(directory(), { intermediates: true });
  const path = `${directory()}${cacheHash(identity)}.json`;
  const temporary = `${path}.part`;
  try {
    const saved = { ...result, schema: 3, identity, generated: true };
    await FileSystem.writeAsStringAsync(temporary, JSON.stringify(saved));
    await FileSystem.deleteAsync(path, { idempotent: true });
    await FileSystem.moveAsync({ from: temporary, to: path });
    if (trackId && libraryId) {
      cacheInMemory(libraryId, trackId, identity, saved);
    }
    return saved;
  } finally { await FileSystem.deleteAsync(temporary, { idempotent: true }).catch(() => {}); }
}
export async function deleteGeneratedLyrics(track, libraryId) {
  clearInMemoryLyrics(libraryId, track?.id);
  const identity = await lyricsCacheIdentity(track, libraryId);
  await FileSystem.deleteAsync(`${directory()}${cacheHash(identity)}.json`, { idempotent: true });
}
