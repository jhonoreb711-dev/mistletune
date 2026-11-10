import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { getLegacyLibraryOwnerId } from './localLibraryIdentity';

const USER_ALBUMS_KEY = 'music-player.user-albums';
const legacyCoverDirectory = new Directory(Paths.document, 'AlbumCovers');
const albumsKey = (libraryId) => `${USER_ALBUMS_KEY}:${libraryId}`;
const libraryCoverDirectory = (libraryId) => new Directory(legacyCoverDirectory, libraryId.replace(/[^a-z0-9_-]/gi, '_'));

export async function getUserAlbums(libraryId) {
  if (!libraryId) return [];
  try {
    const key = albumsKey(libraryId);
    let serialized = await AsyncStorage.getItem(key);
    if (serialized === null && libraryId === await getLegacyLibraryOwnerId()) {
      // Keep legacy shared albums with the original local library.
      const legacy = await AsyncStorage.getItem(USER_ALBUMS_KEY);
      if (legacy !== null) {
        await AsyncStorage.setItem(key, legacy);
        await AsyncStorage.removeItem(USER_ALBUMS_KEY);
        await AsyncStorage.setItem(`music-player.user-albums-owned:${libraryId}`, '1');
        serialized = legacy;
      }
    }
    const albums = serialized ? JSON.parse(serialized) : [];
    return Array.isArray(albums) ? albums : [];
  } catch {
    return [];
  }
}

export async function saveUserAlbum(libraryId, album) {
  if (!libraryId) return [];
  const albums = await getUserAlbums(libraryId);
  const updatedAlbums = [album, ...albums.filter((item) => item.id !== album.id)];
  await AsyncStorage.setItem(albumsKey(libraryId), JSON.stringify(updatedAlbums));
  await AsyncStorage.setItem(`music-player.user-albums-owned:${libraryId}`, '1');
  return updatedAlbums;
}

export async function deleteUserAlbum(libraryId, albumId) {
  if (!libraryId) return [];
  const albums = await getUserAlbums(libraryId);
  const updatedAlbums = albums.filter((album) => album.id !== albumId);
  await AsyncStorage.setItem(albumsKey(libraryId), JSON.stringify(updatedAlbums));
  return updatedAlbums;
}

export async function pickAlbumCover(libraryId) {
  if (!libraryId) return null;
  const result = await File.pickFileAsync({ mimeTypes: ['image/*'] });
  if (result.canceled) return null;

  const coverDirectory = libraryCoverDirectory(libraryId);
  await coverDirectory.create({ idempotent: true, intermediates: true });
  const extension = result.result.name.match(/\.[a-z0-9]+$/i)?.[0] ?? '.jpg';
  const destination = new File(coverDirectory, `album-${Date.now()}${extension}`);
  await result.result.copy(destination, { overwrite: true });
  return destination.uri;
}
