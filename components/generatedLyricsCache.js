import * as FileSystem from 'expo-file-system/legacy';
import { localAudioUri } from './transcriptionUtils';
import { bundledWhisper } from '../assets/models';

const directory = () => `${FileSystem.documentDirectory}GeneratedLyrics/v2/`;
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
  return JSON.stringify({ libraryId, id: track.id, uri, size: info.size, modified: info.modificationTime, model: bundledWhisper?.version || 'not-bundled' });
}
export async function readGeneratedLyrics(track, libraryId) {
  const identity = await lyricsCacheIdentity(track, libraryId);
  const path = `${directory()}${cacheHash(identity)}.json`;
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return null;
  try {
    const saved = JSON.parse(await FileSystem.readAsStringAsync(path));
    if (saved.identity !== identity || saved.schema !== 2 || !validSegments(saved.segments)) return null;
    return saved;
  } catch { return null; }
}
export async function writeGeneratedLyrics(identity, result) {
  if (!validSegments(result.segments)) throw new Error('The generated timestamps are invalid.');
  await FileSystem.makeDirectoryAsync(directory(), { intermediates: true });
  const path = `${directory()}${cacheHash(identity)}.json`;
  const temporary = `${path}.part`;
  try {
    const saved = { ...result, schema: 2, identity, generated: true };
    await FileSystem.writeAsStringAsync(temporary, JSON.stringify(saved));
    await FileSystem.deleteAsync(path, { idempotent: true });
    await FileSystem.moveAsync({ from: temporary, to: path });
    return saved;
  } finally { await FileSystem.deleteAsync(temporary, { idempotent: true }).catch(() => {}); }
}
export async function deleteGeneratedLyrics(track, libraryId) {
  const identity = await lyricsCacheIdentity(track, libraryId);
  await FileSystem.deleteAsync(`${directory()}${cacheHash(identity)}.json`, { idempotent: true });
}
