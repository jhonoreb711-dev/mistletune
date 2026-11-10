import AsyncStorage from '@react-native-async-storage/async-storage';

const PODCAST_VIDEO_KEY = 'music-player.podcast-videos';

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
