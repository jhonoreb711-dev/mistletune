import { Asset } from 'expo-asset';
import { Image } from 'expo-image';

// Warm expo-image's decoded-bitmap cache at splash time, so the GIF/PNG page
// backgrounds are already decoded when the user lands on those pages.
// Videos are excluded (expo-video decodes on the GPU/native side) and large
// bitmaps are skipped to avoid hogging memory before the intro is done.
const PREFETCH_KEYS = ['collection', 'library', 'search', 'settings', 'player', 'chat', 'mascot'];
const MAX_PREFETCH_BYTES = 8 * 1024 * 1024;

/** @param {{ assets?: Record<string, unknown> } | null | undefined} theme */
export function prefetchThemeArtwork(theme) {
  const assets = theme?.assets;
  if (!assets) return Promise.resolve(false);
  const candidates = PREFETCH_KEYS
    .map((key) => assets[key])
    .filter((asset) => typeof asset === 'number');
  if (!candidates.length) return Promise.resolve(false);

  return Asset.loadAsync(candidates)
    .then((loadedAssets) => {
      const urls = loadedAssets
        .filter((asset) => (asset.localUri || asset.uri)
          && asset.width != null
          && asset.height != null
          && asset.width * asset.height * 4 <= MAX_PREFETCH_BYTES)
        .map((asset) => asset.localUri || asset.uri);
      if (!urls.length) return false;
      return Image.prefetch(urls, 'memory-disk');
    })
    .catch(() => false);
}


