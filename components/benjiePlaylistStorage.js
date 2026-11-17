import AsyncStorage from '@react-native-async-storage/async-storage';

const key = (libraryId) => 'music-player.benjie-playlist:' + libraryId;
export async function loadBenjiePlaylist(libraryId) {
  if (!libraryId) return [];
  const raw = await AsyncStorage.getItem(key(libraryId));
  if (!raw) return [];
  const ids = JSON.parse(raw);
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) throw new Error('Could not read Benjie’s Playlist.');
  return [...new Set(ids)];
}
export async function saveBenjiePlaylist(libraryId, ids) {
  if (!libraryId) throw new Error('Your music library is still loading. Please try again.');
  await AsyncStorage.setItem(key(libraryId), JSON.stringify([...new Set(ids)]));
}

// Remove playlist membership only; never change the music library or audio file.
export async function removeBenjiePlaylistSong(libraryId, trackId) {
  const ids = await loadBenjiePlaylist(libraryId);
  const updated = ids.filter((id) => id !== trackId);
  await saveBenjiePlaylist(libraryId, updated);
  return updated;
}
