import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

const PODCAST_VIDEO_KEY = 'music-player.podcast-videos';
const WATCH_HISTORY_KEY = 'music-player.podcast-watch-history';
let historyWrites = Promise.resolve();

export function recordWatchedPodcast(video) {
  historyWrites = historyWrites.catch(() => {}).then(async () => {
    let history = [];
    try {
      const parsed = JSON.parse(await AsyncStorage.getItem(WATCH_HISTORY_KEY) || '[]');
      if (Array.isArray(parsed)) history = parsed;
    } catch {}
    const updated = [{ id: video.id, uri: video.uri, watchedAt: Date.now() },
      ...history.filter((entry) => entry?.id !== video.id)].slice(0, 50);
    await AsyncStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(updated));
  });
  return historyWrites;
}

export async function getRecentlyWatchedPodcasts() {
  await historyWrites.catch(() => {});
  try {
    const [videos, raw] = await Promise.all([getPodcastVideos(), AsyncStorage.getItem(WATCH_HISTORY_KEY)]);
    const history = JSON.parse(raw || '[]');
    if (!Array.isArray(history)) return [];
    // Resolve current titles/covers, and omit removed or replaced videos.
    return history.map((entry) => videos.find((video) => video.id === entry?.id && video.uri === entry.uri)).filter(Boolean);
  } catch {
    return [];
  }
}

export async function getPodcastVideos() {
  try {
    const raw = await AsyncStorage.getItem(PODCAST_VIDEO_KEY);
    const videos = raw ? JSON.parse(raw) : [];
    return Array.isArray(videos)
      ? videos.filter((video) => video && typeof video.id === 'string' && typeof video.uri === 'string')
      : [];
  } catch {
    return [];
  }
}

export async function savePodcastVideos(videos) {
  await AsyncStorage.setItem(PODCAST_VIDEO_KEY, JSON.stringify(videos));
}

export async function pickPodcastCover(videoId) {
  const result = await File.pickFileAsync({ mimeTypes: ['image/*'] });
  if (result.canceled) return null;
  const directory = new Directory(Paths.document, 'PodcastCovers');
  await directory.create({ idempotent: true, intermediates: true });
  const extension = result.result.name.match(/\.[a-z0-9]+$/i)?.[0] || '.jpg';
  const destination = new File(directory, `${videoId.replace(/[^a-z0-9_-]/gi, '_')}_${Date.now()}${extension}`);
  await result.result.copy(destination, { overwrite: true });
  try {
    const videos = await getPodcastVideos();
    const previous = videos.find((video) => video.id === videoId);
    if (!previous) throw new Error('This podcast was removed.');
    const updated = videos.map((video) => video.id === videoId ? { ...video, coverUri: destination.uri } : video);
    await savePodcastVideos(updated);
    if (previous.coverUri?.startsWith(directory.uri)) {
      try { const old = new File(previous.coverUri); if (old.exists) old.delete(); } catch {}
    }
    return updated;
  } catch (error) {
    try { destination.delete(); } catch {}
    throw error;
  }
}
