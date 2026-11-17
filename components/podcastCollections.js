// Flat video records remain compatible with watch history and chatbot playback.
export function buildPodcastEpisodes(videos, { id, title, description }) {
  if (!title?.trim()) throw new Error('Enter a podcast title.');
  if (!videos.length) throw new Error('Choose at least one video.');
  return videos.map((video, index) => ({ ...video, podcastId: id, podcastTitle: title.trim(),
    podcastDescription: (description || '').trim(), episodeNumber: index + 1 }));
}

export function groupPodcastVideos(videos) {
  const groups = new Map();
  for (const video of videos) {
    const id = video.podcastId || `legacy:${video.id}`;
    if (!groups.has(id)) groups.set(id, { id, title: video.podcastTitle || video.title || video.name || 'Podcast',
      description: video.podcastDescription || video.description || '', episodes: [] });
    groups.get(id).episodes.push(video);
  }
  return [...groups.values()].map((group) => ({ ...group,
    episodes: group.episodes.sort((a, b) => (a.episodeNumber || 1) - (b.episodeNumber || 1)) }));
}

// Previewing a show never removes episodes from its persisted collection.
export function getPodcastEpisodePreview(collection) {
  return collection.episodes.slice(0, 3);
}
