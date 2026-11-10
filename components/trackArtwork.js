import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

const artworkRoot = new Directory(Paths.document, 'MusicPlayer');
const artworkDirectory = (libraryId) => new Directory(
  new Directory(artworkRoot, libraryId.replace(/[^a-z0-9_-]/gi, '_')),
  'TrackArtwork',
);
const artworkKey = (libraryId) => `music-player.track-artwork:${libraryId}`;

async function readArtworkMap(libraryId) {
  if (!libraryId) return {};
  try {
    const value = await AsyncStorage.getItem(artworkKey(libraryId));
    const parsed = value ? JSON.parse(value) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function addSavedTrackArtwork(libraryId, tracks) {
  const artworkMap = await readArtworkMap(libraryId);
  return tracks.map((track) => {
    const uri = artworkMap[track.id];
    if (!uri) return track;
    try {
      return new File(uri).exists ? { ...track, artwork: { uri } } : track;
    } catch {
      return track;
    }
  });
}

export async function pickTrackArtwork(libraryId, trackId) {
  if (!libraryId || !trackId) return null;
  const result = await File.pickFileAsync({ mimeTypes: ['image/*'] });
  if (result.canceled) return null;

  const directory = artworkDirectory(libraryId);
  await directory.create({ idempotent: true, intermediates: true });
  const extension = result.result.name.match(/\.[a-z0-9]+$/i)?.[0] ?? '.jpg';
  const safeTrackId = trackId.replace(/[^a-z0-9_-]/gi, '_');
  const destination = new File(directory, `${safeTrackId}_${Date.now()}${extension}`);
  await result.result.copy(destination, { overwrite: true });

  const artworkMap = await readArtworkMap(libraryId);
  const previousUri = artworkMap[trackId];
  artworkMap[trackId] = destination.uri;
  await AsyncStorage.setItem(artworkKey(libraryId), JSON.stringify(artworkMap));

  if (previousUri && previousUri !== destination.uri) {
    try {
      const prevFile = new File(previousUri);
      if (prevFile.exists) prevFile.delete();
    } catch { /* Keep the newly saved cover even if cleanup fails. */ }
  }

  try {
    if (directory.exists) {
      for (const entry of directory.list()) {
        if (entry instanceof File && entry.uri !== destination.uri) {
          if (entry.name.startsWith(`${safeTrackId}_`) || entry.name.startsWith(`${safeTrackId}.`)) {
            try { entry.delete(); } catch {}
          }
        }
      }
    }
  } catch {}

  return destination.uri;
}

export async function removeTrackArtwork(libraryId, trackId) {
  if (!libraryId || !trackId) return;
  const artworkMap = await readArtworkMap(libraryId);
  const previousUri = artworkMap[trackId];
  delete artworkMap[trackId];
  await AsyncStorage.setItem(artworkKey(libraryId), JSON.stringify(artworkMap));

  if (previousUri) {
    try {
      const prevFile = new File(previousUri);
      if (prevFile.exists) prevFile.delete();
    } catch { /* The saved reference is already removed. */ }
  }

  const safeTrackId = trackId.replace(/[^a-z0-9_-]/gi, '_');
  const directory = artworkDirectory(libraryId);
  try {
    if (directory.exists) {
      for (const entry of directory.list()) {
        if (entry instanceof File) {
          if (entry.name.startsWith(`${safeTrackId}_`) || entry.name.startsWith(`${safeTrackId}.`)) {
            try { entry.delete(); } catch {}
          }
        }
      }
    }
  } catch {}
}
