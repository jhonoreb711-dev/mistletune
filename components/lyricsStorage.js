import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { parseLyrics } from './lyricsParser';

const keyFor = (libraryId, trackId) => `music-player.lyrics:${libraryId}:${trackId}`;
export async function loadLyrics(libraryId, trackId) {
  const raw = await AsyncStorage.getItem(keyFor(libraryId, trackId));
  if (!raw) return null;
  const saved = JSON.parse(raw);
  return { ...saved, ...parseLyrics(saved.text) };
}

export async function importLyrics(libraryId, trackId) {
  if (!libraryId || !trackId) throw new Error('Your library is still loading. Please try again.');
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const file = new File(asset.uri);
  try {
    if (!/\.(lrc|txt)$/i.test(asset.name || '')) throw new Error('Choose a .lrc or .txt lyrics file.');
    if ((asset.size || file.size || 0) > 100 * 1024) throw new Error('Choose a lyrics file smaller than 100 KB.');
    const text = await file.text();
    const parsed = parseLyrics(text);
    if (!parsed.lines.length) throw new Error('This file has no lyrics to display.');
    const saved = { text, name: asset.name };
    await AsyncStorage.setItem(keyFor(libraryId, trackId), JSON.stringify(saved));
    return { ...saved, ...parsed };
  } finally {
    // DocumentPicker created this temporary cache copy for this import.
    try { file.delete(); } catch {}
  }
}

export async function removeLyrics(libraryId, trackId) {
  await AsyncStorage.removeItem(keyFor(libraryId, trackId));
}

