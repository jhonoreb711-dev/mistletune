export function swipeRemovalDirection(translationX, velocityX, width) {
  'worklet';
  const distance = Math.abs(translationX);
  const threshold = Math.min(90, width * 0.22);
  const flick = distance >= 18 && Math.abs(velocityX) >= 650
    && Math.sign(velocityX) === Math.sign(translationX);
  return distance >= threshold || flick ? Math.sign(translationX) : 0;
}

export function appendQueueTrack(tracks, track) {
  if (!track?.id || !track.source || tracks.some((item) => item.id === track.id)) return tracks;
  return [...tracks, track];
}

export function availableQueueTracks(library, queue, query = '') {
  const queuedIds = new Set(queue.map((track) => track.id));
  const search = query.trim().toLocaleLowerCase();
  return library.filter((track) => track.source && !queuedIds.has(track.id)
    && `${track.title ?? ''} ${track.artist ?? ''}`.toLocaleLowerCase().includes(search));
}

export function queueAfterRemoval(tracks, trackId, currentTrackId) {
  const index = tracks.findIndex((track) => track.id === trackId);
  if (index < 0) return { tracks, nextTrack: undefined };
  const remaining = tracks.filter((track) => track.id !== trackId);
  const nextTrack = trackId === currentTrackId
    ? (remaining.length ? remaining[index % remaining.length] : null)
    : undefined;
  return { tracks: remaining, nextTrack };
}
