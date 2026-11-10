import AsyncStorage from '@react-native-async-storage/async-storage';

const RECENTLY_PLAYED_LIMIT = 16;
const RECENTLY_PLAYED_MAX_AGE = 24 * 60 * 60 * 1000;
const recentlyPlayedKey = (libraryId) => `music-player.recently-played:${libraryId}`;
const pendingWrites = new Map();

export async function getRecentlyPlayed(libraryId) {
  if (!libraryId) return [];
  try {
    const serialized = await AsyncStorage.getItem(recentlyPlayedKey(libraryId));
    const entries = serialized ? JSON.parse(serialized) : [];
    if (!Array.isArray(entries)) return [];
    const now = Date.now();
    const activeEntries = entries
      .filter(isValidEntry)
      .map((entry) => Number.isFinite(entry.playedAt) ? entry : { ...entry, playedAt: now })
      .filter((entry) => now - entry.playedAt < RECENTLY_PLAYED_MAX_AGE)
      .sort((first, second) => second.playedAt - first.playedAt)
      .slice(0, RECENTLY_PLAYED_LIMIT);
    if (JSON.stringify(activeEntries) !== serialized) {
      await AsyncStorage.setItem(recentlyPlayedKey(libraryId), JSON.stringify(activeEntries));
    }
    return activeEntries;
  } catch {
    return [];
  }
}

export function addRecentlyPlayed(libraryId, entry) {
  if (!libraryId || !isValidEntry(entry)) return Promise.resolve([]);
  const previousWrite = pendingWrites.get(libraryId) ?? Promise.resolve();
  const timestampedEntry = { ...entry, playedAt: Date.now() };
  const write = previousWrite.catch(() => {}).then(async () => {
    const entries = await getRecentlyPlayed(libraryId);
    const next = [timestampedEntry, ...entries.filter((item) => item.type !== entry.type || item.id !== entry.id)]
      .slice(0, RECENTLY_PLAYED_LIMIT);
    await AsyncStorage.setItem(recentlyPlayedKey(libraryId), JSON.stringify(next));
    return next;
  });
  pendingWrites.set(libraryId, write);
  return write.finally(() => {
    if (pendingWrites.get(libraryId) === write) pendingWrites.delete(libraryId);
  });
}

function isValidEntry(entry) {
  if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || !entry.id) return false;
  if (entry.type === 'track') return true;
  return entry.type === 'album'
    && Array.isArray(entry.trackIds)
    && entry.trackIds.every((id) => typeof id === 'string');
}
