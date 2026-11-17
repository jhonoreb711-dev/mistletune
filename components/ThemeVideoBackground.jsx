import { useEffect, useRef } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTheme } from '../themes/ThemeProvider';

// Full-screen looping background from the active theme. Themes provide either
// a homeVideo (rendered muted, via expo-video) or a homeVideoImage (a GIF,
// rendered via expo-image with autoplay). Halloween's Halloween_background.gif
// is the current example. Swapping themes reloads without recreating players.
export default function ThemeVideoBackground() {
  const { theme } = useTheme();
  const videoSource = typeof theme.assets.homeVideo === 'number' ? theme.assets.homeVideo : null;
  const imageSource = theme.assets.homeVideoImage ?? null;
  const player = useVideoPlayer(videoSource, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
    if (videoSource) videoPlayer.play();
  });
  const currentSourceRef = useRef(videoSource);

  useEffect(() => {
    if (!videoSource) {
      currentSourceRef.current = null;
      try { player.pause(); } catch { /* unpopulated player */ }
      return undefined;
    }
    if (currentSourceRef.current === videoSource) return undefined;
    currentSourceRef.current = videoSource;
    let active = true;
    player.replaceAsync(videoSource)
      .then(() => {
        if (!active) return;
        try { player.loop = true; player.play(); } catch { /* source may not be ready yet */ }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [videoSource, player]);

  if (imageSource) {
    return (
      <Image
        source={imageSource}
        autoplay
        isAnimated
        contentFit="cover"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    );
  }
  if (!videoSource) return null;

  return (
    <VideoView
      style={StyleSheet.absoluteFill}
      player={player}
      contentFit="cover"
      nativeControls={false}
      pointerEvents="none"
      surfaceType={Platform.OS === 'android' ? 'textureView' : undefined}
    />
  );
}
