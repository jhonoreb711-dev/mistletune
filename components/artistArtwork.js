import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

const artworkKey = (libraryId) => `music-player.artist-artwork:${libraryId}`;
const artworkDirectory = (libraryId) => new Directory(
  Paths.document,
  'ArtistCovers',
  libraryId.replace(/[^a-z0-9_-]/gi, '_')
);

export async function getArtistCovers(libraryId) {
  if (!libraryId) return {};
  try {
    const serialized = await AsyncStorage.getItem(artworkKey(libraryId));
    const covers = serialized ? JSON.parse(serialized) : {};
    return covers && typeof covers === 'object' && !Array.isArray(covers) ? covers : {};
  } catch {
    return {};
  }
}

export async function pickArtistCover(libraryId, artistId) {
  if (!libraryId || !artistId) return null;
  const result = await File.pickFileAsync({ mimeTypes: ['image/*'] });
  if (result.canceled) return null;

  const directory = artworkDirectory(libraryId);
  await directory.create({ idempotent: true, intermediates: true });
  const extension = result.result.name.match(/\.[a-z0-9]+$/i)?.[0] ?? '.jpg';
  const filename = `artist-${encodeURIComponent(artistId)}-${Date.now()}${extension}`;
  const destination = new File(directory, filename);
  await result.result.copy(destination);

  const covers = await getArtistCovers(libraryId);
  const previousUri = covers[artistId];
  covers[artistId] = destination.uri;
  await AsyncStorage.setItem(artworkKey(libraryId), JSON.stringify(covers));

  if (previousUri) {
    const previousFile = new File(previousUri);
    if (previousFile.exists) previousFile.delete();
  }
  return destination.uri;
}

export async function removeArtistCover(libraryId, artistId) {
  if (!libraryId || !artistId) return;
  const covers = await getArtistCovers(libraryId);
  const previousUri = covers[artistId];
  delete covers[artistId];
  await AsyncStorage.setItem(artworkKey(libraryId), JSON.stringify(covers));

  if (previousUri) {
    const previousFile = new File(previousUri);
    if (previousFile.exists) previousFile.delete();
  }
}
