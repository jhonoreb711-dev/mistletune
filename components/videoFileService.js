import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HOME_VIDEO_NAME_KEY, HOME_VIDEO_URI_KEY } from './homeVideoStorage';

/**
 * Safely removes a file from the app file system if it exists.
 */
export async function deleteVideoFile(fileUri) {
  if (!fileUri || typeof fileUri !== 'string' || !fileUri.startsWith('file://')) {
    return;
  }
  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    if (info.exists) {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    }
  } catch {}
}

/**
 * Sanitizes and extracts the file extension and display name for a video asset.
 */
function extractVideoInfo(asset, fallbackPrefix = 'video') {
  let name = (asset.name || '').trim();
  if (!name && asset.uri) {
    const rawName = asset.uri.split(/[?#]/)[0].split('/').pop() || '';
    try {
      name = decodeURIComponent(rawName);
    } catch {
      name = rawName;
    }
  }

  const extMatch = name.match(/\.[a-z0-9]{2,5}$/i);
  const extension = extMatch ? extMatch[0].toLowerCase() : '.mp4';
  if (!name) {
    name = `${fallbackPrefix}${extension}`;
  } else if (!/\.[a-z0-9]{2,5}$/i.test(name)) {
    name = `${name}${extension}`;
  }

  return { name, extension };
}

/**
 * Copies a picked video asset into persistent application storage.
 *
 * On Android, expo-document-picker returns a content:// URI when copyToCacheDirectory is false.
 * FileSystem.copyAsync reads from content:// URIs directly via ContentResolver, avoiding
 * permission errors that happen when accessing Expo Go's cache subdirectories.
 */
async function copyAssetToAppStorage(asset, targetPrefix) {
  const { name, extension } = extractVideoInfo(asset, targetPrefix);
  const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
  if (!baseDir) {
    throw new Error('Storage directory unavailable on this device.');
  }

  try {
    const dirInfo = await FileSystem.getInfoAsync(baseDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });
    }
  } catch {}

  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const destinationUri = `${baseDir}${targetPrefix}-${uniqueId}${extension}`;

  await FileSystem.copyAsync({
    from: asset.uri,
    to: destinationUri,
  });

  const check = await FileSystem.getInfoAsync(destinationUri);
  if (!check.exists || (check.size !== undefined && check.size === 0)) {
    try {
      await FileSystem.deleteAsync(destinationUri, { idempotent: true });
    } catch {}
    throw new Error(`Failed to copy "${name}". Video file is empty or unreadable.`);
  }

  return { uri: destinationUri, name, size: check.size };
}

/**
 * Prompts user to pick a new Home Screen video and saves it to app storage.
 * Updates AsyncStorage and deletes any previous custom video.
 */
export async function pickAndSaveHomeVideo() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['video/*'],
    multiple: false,
    copyToCacheDirectory: false,
  });

  if (result.canceled || !result.assets || !result.assets.length) {
    return null;
  }

  const selectedAsset = result.assets[0];
  const previousUri = await AsyncStorage.getItem(HOME_VIDEO_URI_KEY);

  const saved = await copyAssetToAppStorage(selectedAsset, 'home-screen-video');

  await AsyncStorage.multiSet([
    [HOME_VIDEO_URI_KEY, saved.uri],
    [HOME_VIDEO_NAME_KEY, saved.name],
  ]);

  if (previousUri && previousUri !== saved.uri) {
    await deleteVideoFile(previousUri);
  }

  return saved;
}

/**
 * Restores the default home video by removing the custom video from storage and disk.
 */
export async function restoreDefaultHomeVideo() {
  const previousUri = await AsyncStorage.getItem(HOME_VIDEO_URI_KEY);
  await AsyncStorage.multiRemove([HOME_VIDEO_URI_KEY, HOME_VIDEO_NAME_KEY]);
  if (previousUri) {
    await deleteVideoFile(previousUri);
  }
}

/**
 * Prompts user to pick one or more videos for their Podcast collection.
 * Saves them to app storage and returns the newly saved items.
 */
export async function pickAndSavePodcastVideos(multiple = true) {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['video/*'],
    multiple,
    copyToCacheDirectory: false,
  });

  if (result.canceled || !result.assets || !result.assets.length) {
    return [];
  }

  const copiedFiles = [];
  const savedVideos = [];

  try {
    for (let i = 0; i < result.assets.length; i++) {
      const asset = result.assets[i];
      const saved = await copyAssetToAppStorage(asset, `podcast-video-${Date.now()}-${i}`);
      copiedFiles.push(saved.uri);
      savedVideos.push({
        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        name: saved.name,
        uri: saved.uri,
      });
    }
    return savedVideos;
  } catch (error) {
    for (const uri of copiedFiles) {
      await deleteVideoFile(uri);
    }
    throw error;
  }
}

/**
 * Replaces a single existing podcast video with a newly chosen video.
 */
export async function pickAndReplacePodcastVideo(existingVideo) {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['video/*'],
    multiple: false,
    copyToCacheDirectory: false,
  });

  if (result.canceled || !result.assets || !result.assets.length) {
    return null;
  }

  const selectedAsset = result.assets[0];
  const saved = await copyAssetToAppStorage(selectedAsset, `podcast-video-rep-${Date.now()}`);

  if (existingVideo?.uri && existingVideo.uri !== saved.uri) {
    await deleteVideoFile(existingVideo.uri);
  }

  return {
    id: existingVideo?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ...(existingVideo?.coverUri ? { coverUri: existingVideo.coverUri } : {}),
    ...(existingVideo?.title ? { title: existingVideo.title } : {}),
    name: saved.name,
    uri: saved.uri,
  };
}
