// Podcast pages use still/animated artwork, never the Home MP4.
const artwork = {
  rainy: { podcast: require('../themes/rainy theme/rain_podcast.gif') },
  summer: { podcast: require('../themes/Summer theme/summer_podcast.gif') },
  valentines: { album: require('../themes/Valentines/valentines_album.gif') },
  halloween: { background: require('../themes/Halloween/Halloween_background.gif') },
  newyear: { background: require('../themes/New Year/newyear_Background.gif') },
  independence: { background: require('../themes/Independence Theme/independence_background.gif') },
};
export function getPodcastBackground(theme) {
  const available = artwork[theme.id] || {};
  return theme.assets.podcast || available.podcast || theme.assets.album || available.album
    || theme.assets.background || available.background || theme.assets.collection || null;
}
