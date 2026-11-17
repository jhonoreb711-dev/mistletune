function splitArtistCredits(credit) {
  return (credit || '')
    .split(/\s*(?:;|&|\/|\band\b|\bfeat\.?|\bft\.?|\bfeaturing\b|\bwith\b)\s*/i)
    .map((artist) => artist.trim())
    .filter((artist) => artist && artist.toLocaleLowerCase() !== 'unknown artist');
}

export function buildArtistCollections(tracks) {
  const grouped = new Map();

  for (const track of tracks) {
    const artists = new Map(splitArtistCredits(track.artist).map((artist) => [artist.toLocaleLowerCase(), artist]));
    for (const [id, artist] of artists) {
      const collection = grouped.get(id) ?? {
        id,
        artist,
        artwork: track.artwork ?? null,
        tracks: [],
      };
      if (!collection.artwork && track.artwork) collection.artwork = track.artwork;
      if (!collection.tracks.some((item) => item.id === track.id)) collection.tracks.push(track);
      grouped.set(id, collection);
    }
  }

  return [...grouped.values()].sort((first, second) => first.artist.localeCompare(second.artist, undefined, { sensitivity: 'base' }));
}
