import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';

// Deliberately rejects Metro/HTTP assets instead of silently fetching them.
// In a release build require() assets are packaged in the APK/IPA.
export async function resolveBundledResource(source) {
  if (typeof source === 'string') {
    if (!source.startsWith('file://')) throw new Error('Offline lyrics refuses remote model resources.');
    return source.slice(7);
  }
  if (typeof source !== 'number') throw new Error('Whisper model is not bundled. Run npm run lyrics:models and rebuild.');
  const asset = Asset.fromModule(source);
  const uri = asset.localUri || asset.uri;
  const isLocal = typeof uri === 'string' && (uri.startsWith('file://') || uri.startsWith('asset://')
    || (!uri.includes(':') && !uri.startsWith('//')));
  if (!isLocal) {
    throw new Error('Whisper assets are served by Metro. Use an embedded release APK for fully offline lyrics.');
  }
  if (!asset.localUri?.startsWith('file://')) {
    // Only copies embedded Android/iOS assets; HTTP URLs were rejected above.
    await asset.downloadAsync();
  }
  if (!asset.localUri?.startsWith('file://')) throw new Error('Could not open the bundled Whisper asset.');
  return asset.localUri.slice(7);
}

export const offlineResourceFetcher = {
  async fetch(callback, ...sources) {
    const paths = await Promise.all(sources.map(resolveBundledResource));
    callback?.(1);
    // Also disables the library's remote download counters/telemetry path.
    return { paths, wasDownloaded: paths.map(() => false) };
  },
  readAsString(path) {
    if (typeof path !== 'string' || !path.startsWith('/')) throw new Error('Only local model files are supported.');
    return FileSystem.readAsStringAsync(`file://${path}`);
  },
};
