import { Directory, File, FileMode, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLegacyLibraryOwnerId } from './localLibraryIdentity';

const SUPPORTED_AUDIO = /\.(mp3|m4a|wav|aac|ogg|flac)$/i;
const legacyLibraryDirectory = new Directory(Paths.document, 'MusicPlayer');
const LEGACY_FOLDER_KEY = 'music-player.music-folder-uri';

function sanitizeDestinationFileName(name) {
  if (!name) return 'track.mp3';
  return name
    .replace(/\[/g, '(')
    .replace(/\]/g, ')')
    .replace(/\{/g, '(')
    .replace(/\}/g, ')')
    .replace(/[<>"#%^`|\\?*:]/g, '_')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .trim();
}

function scopedDirectory(libraryId) {
  if (!libraryId) return null;
  return new Directory(legacyLibraryDirectory, libraryId.replace(/[^a-z0-9_-]/gi, '_'));
}

async function ensureLocalLibrary(libraryId) {
  const directory = scopedDirectory(libraryId);
  if (!directory) return null;
  await directory.create({ idempotent: true, intermediates: true });
  const migrationKey = `music-player.library-migrated:${libraryId}`;
  if (await AsyncStorage.getItem(migrationKey)) return directory;

  // The old app had one shared library. Keep its files with the first saved
  // local library when migrating to the single-user version.
  const ownsLegacyData = libraryId === await getLegacyLibraryOwnerId();
  if (ownsLegacyData && legacyLibraryDirectory.exists) {
    for (const sourceFile of audioFilesIn(legacyLibraryDirectory)) {
      const destination = new File(directory, sanitizeDestinationFileName(sourceFile.name));
      if (!destination.exists) await sourceFile.copy(destination);
    }
  }
  const legacyFolder = ownsLegacyData ? await AsyncStorage.getItem(LEGACY_FOLDER_KEY) : null;
  if (legacyFolder) {
    const scopedFolderKey = `music-player.music-folder-uri:${libraryId}`;
    if (!(await AsyncStorage.getItem(scopedFolderKey))) await AsyncStorage.setItem(scopedFolderKey, legacyFolder);
    await AsyncStorage.removeItem(LEGACY_FOLDER_KEY);
  }
  await AsyncStorage.setItem(migrationKey, '1');
  return directory;
}

function decodeTagText(bytes) {
  if (!bytes.length) return '';
  const encoding = bytes[0];
  const data = bytes.subarray(1);
  try {
    if (encoding === 1 || encoding === 2) {
      const littleEndian = encoding === 1 && !(data[0] === 0xfe && data[1] === 0xff);
      const start = encoding === 1 && (data[0] === 0xff || data[0] === 0xfe) ? 2 : 0;
      let value = '';
      for (let index = start; index + 1 < data.length; index += 2) {
        const first = data[index];
        const second = data[index + 1];
        value += String.fromCharCode(littleEndian ? first | (second << 8) : (first << 8) | second);
      }
      return value.replace(/\0+/g, ' & ').trim();
    }
    return new TextDecoder(encoding === 3 ? 'utf-8' : 'windows-1252').decode(data).replace(/\0+/g, ' & ').trim();
  } catch {
    return '';
  }
}

function synchsafeSize(bytes, offset) {
  return (bytes[offset] << 21) | (bytes[offset + 1] << 14) | (bytes[offset + 2] << 7) | bytes[offset + 3];
}

function estimateMp3Duration(frameBytes, fileSize, audioOffset) {
  const bitrateMpeg1Layer3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
  const bitrateMpeg2Layer3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
  for (let offset = 0; offset + 4 <= frameBytes.length; offset += 1) {
    const first = frameBytes[offset];
    const second = frameBytes[offset + 1];
    const third = frameBytes[offset + 2];
    const fourth = frameBytes[offset + 3];
    if (first !== 0xff || (second & 0xe0) !== 0xe0) continue;

    const version = (second >> 3) & 0x03;
    const layer = (second >> 1) & 0x03;
    const bitrateIndex = (third >> 4) & 0x0f;
    const sampleRateIndex = (third >> 2) & 0x03;
    if (version === 1 || layer !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) continue;

    const mpeg1 = version === 3;
    const bitrate = (mpeg1 ? bitrateMpeg1Layer3 : bitrateMpeg2Layer3)[bitrateIndex];
    const sampleRates = version === 3 ? [44100, 48000, 32000] : version === 2 ? [22050, 24000, 16000] : [11025, 12000, 8000];
    const sampleRate = sampleRates[sampleRateIndex];
    const samplesPerFrame = mpeg1 ? 1152 : 576;
    const frameStart = offset;
    const crcBytes = second & 1 ? 0 : 2;
    const mono = (fourth >> 6) === 3;
    const sideInfoBytes = mpeg1 ? (mono ? 17 : 32) : (mono ? 9 : 17);
    const xingOffset = frameStart + 4 + crcBytes + sideInfoBytes;
    const marker = String.fromCharCode(...frameBytes.subarray(xingOffset, xingOffset + 4));

    if (marker === 'Xing' || marker === 'Info') {
      const flags = (frameBytes[xingOffset + 4] << 24) | (frameBytes[xingOffset + 5] << 16) | (frameBytes[xingOffset + 6] << 8) | frameBytes[xingOffset + 7];
      if (flags & 1) {
        const frameCount = (frameBytes[xingOffset + 8] * 0x1000000)
          + (frameBytes[xingOffset + 9] << 16)
          + (frameBytes[xingOffset + 10] << 8)
          + frameBytes[xingOffset + 11];
        if (frameCount > 0) return Math.round((frameCount * samplesPerFrame) / sampleRate);
      }
    }

    const audioDataBytes = Math.max(0, fileSize - audioOffset);
    return Math.round((audioDataBytes * 8) / (bitrate * 1000));
  }
  return null;
}

function readFrameText(bytes, frameId) {
  if (bytes.length < 10 || String.fromCharCode(...bytes.subarray(0, 3)) !== 'ID3') return '';
  const version = bytes[3];
  const tagSize = Math.min(synchsafeSize(bytes, 6), bytes.length - 10);
  let offset = 10;
  while (offset + 10 <= 10 + tagSize) {
    const id = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    if (!id.trim()) break;
    const frameSize = version === 4 ? synchsafeSize(bytes, offset + 4) : ((bytes[offset + 4] << 24) | (bytes[offset + 5] << 16) | (bytes[offset + 6] << 8) | bytes[offset + 7]);
    if (frameSize <= 0 || offset + 10 + frameSize > bytes.length) break;
    if (id === frameId) {
      const text = decodeTagText(bytes.subarray(offset + 10, offset + 10 + frameSize));
      // ID3v2.3 represents multiple artists in a text frame with a slash.
      return (frameId === 'TPE1' || frameId === 'TPE2') && version === 3
        ? text.replace(/\s*\/\s*/g, ' & ')
        : text;
    }
    offset += 10 + frameSize;
  }
  return '';
}

function includeFeaturedArtists(artist, title) {
  const featureMatch = title.match(/\b(ft\.?|feat\.?|featuring)\s+(.+?)\s*$/i);
  const featureMarker = featureMatch?.[1];
  const featureCredit = featureMatch?.[2]
    ?.replace(/[)\]]+$/, '')
    .replace(/^[([]+/, '')
    .trim();
  if (!featureCredit || artist.toLocaleLowerCase().includes(featureCredit.toLocaleLowerCase())) return artist;
  return `${artist} ${featureMarker} ${featureCredit}`;
}

async function readMp3Tags(file) {
  if (!/\.mp3$/i.test(file.name)) return {};
  let handle;
  try {
    handle = file.open(FileMode.ReadOnly);
    const header = await handle.readBytes(10);
    const hasId3Tag = header.length >= 10 && String.fromCharCode(...header.subarray(0, 3)) === 'ID3';
    const tagSize = hasId3Tag ? synchsafeSize(header, 6) : 0;
    if (tagSize > 2 * 1024 * 1024) return {};
    let tag = new Uint8Array(0);
    let audioOffset = 0;
    if (hasId3Tag && tagSize > 0) {
      handle.offset = 0;
      tag = await handle.readBytes(tagSize + 10);
      audioOffset = tagSize + 10;
    }
    const taggedDuration = Number.parseFloat(readFrameText(tag, 'TLEN')) / 1000;
    handle.offset = audioOffset;
    const frameHeader = await handle.readBytes(96);
    return {
      artist: readFrameText(tag, 'TPE1'),
      albumArtist: readFrameText(tag, 'TPE2'),
      title: readFrameText(tag, 'TIT2'),
      album: readFrameText(tag, 'TALB'),
      durationSeconds: Number.isFinite(taggedDuration) && taggedDuration > 0
        ? Math.round(taggedDuration)
        : estimateMp3Duration(frameHeader, file.size ?? 0, audioOffset),
    };
  } catch {
    return {};
  } finally {
    handle?.close();
  }
}

async function toTrack(file) {
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const artistTitleSeparator = baseName.match(/\s+-\s+/);
  const separatorIndex = artistTitleSeparator?.index ?? -1;
  const filenameArtist = separatorIndex >= 0 ? baseName.slice(0, separatorIndex).trim() : '';
  const filenameTitle = separatorIndex >= 0
    ? baseName.slice(separatorIndex + artistTitleSeparator[0].length).trim()
    : '';
  const tags = await readMp3Tags(file);
  const title = tags.title || filenameTitle || baseName || file.name;
  const artist = tags.artist || (filenameTitle ? filenameArtist : 'Unknown Artist');
  return {
    id: `local-${file.name.toLocaleLowerCase()}`,
    title,
    artist: includeFeaturedArtists(artist, title),
    album: tags.album || null,
    albumArtist: tags.albumArtist || artist,
    durationSeconds: tags.durationSeconds ?? null,
    kind: 'Music',
    source: file.uri,
    artwork: null,
  };
}

function audioFilesIn(directory) {
  return directory.list().filter((entry) => entry instanceof File && SUPPORTED_AUDIO.test(entry.name));
}

function audioFilesRecursively(directory, parentPath = '') {
  const files = [];
  for (const entry of directory.list()) {
    if (entry instanceof Directory) {
      files.push(...audioFilesRecursively(entry, `${parentPath}${entry.name}/`));
    } else if (entry?.uri && typeof entry.name === 'string' && SUPPORTED_AUDIO.test(entry.name)) {
      files.push({ file: new File(entry.uri), name: entry.name, relativePath: `${parentPath}${entry.name}` });
    }
  }
  return files;
}

export async function selectMusicFolder() {
  const directory = await Directory.pickDirectoryAsync();
  // The SDK 58 Directory API handles SAF document URIs, including child
  // directories, and preserves the system picker's persisted folder grant.
  directory.list();
  return directory;
}

export async function importSelectedAudioFiles(libraryId) {
  const libraryDirectory = await ensureLocalLibrary(libraryId);
  if (!libraryDirectory) return [];
  const pickedFiles = await File.pickFileAsync({ multipleFiles: true, mimeTypes: ['audio/*'] });
  if (pickedFiles.canceled) return [];
  await libraryDirectory.create({ idempotent: true, intermediates: true });

  for (const sourceFile of pickedFiles.result) {
    if (!SUPPORTED_AUDIO.test(sourceFile.name)) continue;
    const destination = new File(libraryDirectory, sanitizeDestinationFileName(sourceFile.name));
    await sourceFile.copy(destination, { overwrite: true });
  }

  return listImportedAudio(libraryId);
}

export async function scanMusicFolder(folderUri, libraryId) {
  const libraryDirectory = await ensureLocalLibrary(libraryId);
  if (!libraryDirectory) return [];
  if (!folderUri) return listImportedAudio(libraryId);
  if (Platform.OS === 'android' && !folderUri.startsWith('content://')) {
    throw new Error('This saved folder path cannot be rescanned on Android. Choose the music folder again, then rescan.');
  }

  const selectedDirectory = new Directory(folderUri);
  if (!selectedDirectory.exists) {
    throw new Error('Cannot access the selected folder. Choose it again, then rescan.');
  }
  let sourceFiles;
  try {
    sourceFiles = audioFilesRecursively(selectedDirectory);
  } catch (error) {
    throw new Error(`Could not read the selected music folder. Choose it again and allow access. ${error.message || ''}`.trim());
  }
  if (sourceFiles.length === 0) {
    throw new Error('No supported audio files were found in this folder or its subfolders. If Android asks for folder access, tap Allow, then choose the folder again.');
  }
  await libraryDirectory.create({ idempotent: true, intermediates: true });

  const fileNameCounts = new Map();
  for (const { file, name = file.name } of sourceFiles) {
    const cleanName = sanitizeDestinationFileName(name);
    const normalizedName = cleanName.toLocaleLowerCase();
    fileNameCounts.set(normalizedName, (fileNameCounts.get(normalizedName) ?? 0) + 1);
  }

  const importedNames = new Set();
  const copyErrors = [];
  for (const { file, name = file.name, relativePath } of sourceFiles) {
    const cleanName = sanitizeDestinationFileName(name);
    const destinationName = fileNameCounts.get(cleanName.toLocaleLowerCase()) > 1
      ? `${relativePath.replace(/[^a-z0-9._-]+/gi, '_')}__${cleanName}`
      : cleanName;
    importedNames.add(destinationName.toLocaleLowerCase());
    const destination = new File(libraryDirectory, destinationName);
    try {
      await file.copy(destination, { overwrite: true });
    } catch (error) {
      copyErrors.push({ path: relativePath, message: error.message || 'file access failed' });
    }
  }

  if (copyErrors.length === sourceFiles.length && sourceFiles.length > 0) {
    throw new Error(`Could not copy ${copyErrors[0].path}: ${copyErrors[0].message}`);
  }

  for (const importedFile of audioFilesIn(libraryDirectory)) {
    if (!importedNames.has(importedFile.name.toLocaleLowerCase())) importedFile.delete();
  }

  return listImportedAudio(libraryId);
}

export async function listImportedAudio(libraryId) {
  const libraryDirectory = await ensureLocalLibrary(libraryId);
  if (!libraryDirectory) return [];
  if (!libraryDirectory.exists) return [];
  // This directory already belongs exclusively to libraryId. Filtering its
  // files by matching names and sizes in the old shared directory can hide a
  // valid imported song, especially after the account-to-library migration.
  return Promise.all(audioFilesIn(libraryDirectory).map(toTrack));
}

export function getFolderLabel(folderUri) {
  if (!folderUri) return '';
  try {
    const decodedUri = decodeURIComponent(folderUri);
    const treePath = decodedUri.match(/\/tree\/([^?#]+)/)?.[1];
    if (treePath) {
      const separatorIndex = treePath.indexOf(':');
      const volume = separatorIndex >= 0 ? treePath.slice(0, separatorIndex) : '';
      const relativePath = separatorIndex >= 0 ? treePath.slice(separatorIndex + 1) : treePath;
      const rootLabel = volume.toLocaleLowerCase() === 'primary' ? 'Internal storage' : volume || 'Device storage';
      return [rootLabel, relativePath].filter(Boolean).join('/').replace(/\/+$/g, '');
    }
    const filePath = decodedUri.replace(/^file:\/\/\/storage\/emulated\/0\/?/i, '');
    if (filePath !== decodedUri) return filePath || 'Internal storage';
    return decodedUri.split('/').filter(Boolean).pop() || 'Music folder';
  } catch {
    return 'Selected music folder';
  }
}
