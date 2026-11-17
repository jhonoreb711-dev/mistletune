import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { createVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeStyles } from '../themes/ThemeProvider';

// One temporary decoder for the entire app, released after each still image.
let previewQueue = Promise.resolve();
const pending = new Map();
const previews = new Map();

function getPreview(video) {
  const key = `podcast-preview-v1:${video.id}:${video.uri}`;
  if (video.coverUri) {
    return AsyncStorage.getItem(key).then((duration) => Number(duration) > 0
      ? { image: { uri: video.coverUri }, duration: Number(duration) }
      : getPreview({ id: video.id, uri: video.uri }));
  }
  if (previews.has(key)) return Promise.resolve(previews.get(key));
  if (pending.has(key)) return pending.get(key);
  const task = previewQueue.then(async () => {
    let image = null;
    try { image = await Image.readFromCacheAsync(key); } catch {}
    const duration = Number(await AsyncStorage.getItem(key));
    if (image && duration > 0) return { image, duration };
    const player = createVideoPlayer(null);
    let subscription;
    let errorSubscription;
    let timer;
    try {
      player.muted = true;
      const loaded = new Promise((resolve, reject) => {
        subscription = player.addListener('sourceLoad', resolve);
        errorSubscription = player.addListener('statusChange', ({ status, error }) => {
          if (status === 'error') reject(new Error(error?.message || 'Video unavailable'));
        });
        timer = setTimeout(() => reject(new Error('Video preview timed out')), 12000);
      });
      const [, source] = await Promise.all([player.replaceAsync(video.uri), loaded]);
      const seconds = source.duration || player.duration || 0;
      await AsyncStorage.setItem(key, String(seconds));
      let thumbnail = image;
      let thumbnailError = null;
      try {
        // Android's native bridge expects List<Duration>, even for one frame.
        [thumbnail] = await player.generateThumbnailsAsync([Math.min(1, seconds / 2)], { maxWidth: 320, maxHeight: 180 });
        if (!thumbnail) throw new Error('No thumbnail available');
        try { await Image.writeToCacheAsync(thumbnail, key); } catch {}
      } catch (error) {
        thumbnailError = error.message;
        console.warn('Podcast thumbnail extraction failed:', error);
      }
      const result = { image: thumbnail, duration: seconds, thumbnailError };
      if (thumbnail) {
        previews.set(key, result);
        if (previews.size > 24) previews.delete(previews.keys().next().value);
      }
      return result;
    } finally {
      clearTimeout(timer);
      subscription?.remove();
      errorSubscription?.remove();
      player.release();
    }
  });
  pending.set(key, task);
  previewQueue = task.catch(() => {});
  task.finally(() => pending.delete(key)).catch(() => {});
  return task;
}

export function podcastTitle(video) {
  return (video.title || video.name || 'Podcast').replace(/\.[a-z0-9]{2,5}$/i, '');
}

export default function PodcastCard({ video, onPress, onRename, horizontal = false, collection = null, albumSized = false, onDelete }) {
  const { styles, colors: COLORS } = useThemeStyles(createStyles, BASE_COLORS);
  const [preview, setPreview] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    getPreview({ id: video.id, uri: video.uri, coverUri: video.coverUri }).then((result) => { if (active) setPreview(result); }).catch((error) => {
      if (active) setFailed(true);
      console.warn('Podcast preview unavailable:', error.message);
    });
    return () => { active = false; };
  }, [video.id, video.uri, video.coverUri]);
  const description = collection?.description || video.podcastDescription || video.description;
  const episodeTitle = video.podcastTitle && video.episodeNumber ? `${video.title || video.podcastTitle} · Episode ${video.episodeNumber}` : video.episodeNumber ? `Episode ${video.episodeNumber} · ${podcastTitle(video)}` : podcastTitle(video);
  const seconds = Math.floor(preview?.duration || 0);
  const duration = seconds > 0 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : failed ? 'Could not read video' : 'Loading duration…';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={collection ? `Open podcast ${collection.title}` : `Play podcast ${podcastTitle(video)}`}
      onPress={onPress} style={({ pressed }) => [styles.card, horizontal ? styles.tile : styles.row, albumSized && styles.albumCard, pressed && { opacity: 0.75 }]}>
      <View style={[styles.thumbnail, horizontal && styles.tileThumbnail, albumSized && styles.albumThumbnail]}>
        {video.coverUri || preview?.image ? <Image source={video.coverUri ? { uri: video.coverUri } : preview.image} contentFit="cover" style={StyleSheet.absoluteFill} /> :
          <Ionicons name="videocam-outline" size={28} color={COLORS.ember} />}
        {onDelete && <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${episodeTitle}`} onPress={(event) => { event.stopPropagation(); onDelete(); }} hitSlop={6} style={styles.deleteButton}><Ionicons name="trash-outline" size={16} color="#fff8e9" /></Pressable>}
      </View>
      <View style={[styles.details, horizontal && styles.tileDetails]}>
        <Text numberOfLines={2} style={[styles.title, albumSized && styles.albumTitle]}>{collection?.title || episodeTitle}</Text>
        {!!description && <Text numberOfLines={3} style={styles.description}>{description}</Text>}
        <Text numberOfLines={1} style={styles.subtitle}>{collection ? `${collection.episodes.length} ${collection.episodes.length === 1 ? 'episode' : 'episodes'}` : `Podcast · ${duration}`}</Text>
      </View>
      {onRename && <Pressable accessibilityRole="button" accessibilityLabel={`Rename ${podcastTitle(video)}`} hitSlop={8} onPress={(event) => { event.stopPropagation(); onRename(); }} style={{ padding: 6 }}><Ionicons name="pencil-outline" size={18} color={COLORS.ember} /></Pressable>}
      {!horizontal && <Ionicons name={collection ? 'chevron-forward-circle' : 'play-circle'} size={34} color={COLORS.ember} />}
    </Pressable>
  );
}

const BASE_COLORS = { green: '#164d38', ember: '#f4c86a' };

const createStyles = (colors) => StyleSheet.create({
  deleteButton: { position: 'absolute', top: 5, right: 5, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 14, borderWidth: 1, borderColor: 'rgba(244,200,106,0.6)', backgroundColor: colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 12, minHeight: 100 },
  tile: { width: 166, overflow: 'hidden', paddingBottom: 10 },
  albumCard: { width: 96, alignSelf: 'flex-start', borderWidth: 0, backgroundColor: colors.surface, borderRadius: 13 },
  albumThumbnail: { width: 96, height: 104, borderRadius: 13, borderWidth: 2, borderColor: colors.ember },
  albumTitle: { color: colors.ember, fontFamily: 'NunitoExtraBold', fontSize: 12 },
  tileDetails: { flex: 0 },
  description: { color: colors.onSurfaceMuted, fontFamily: 'NunitoRegular', fontSize: 11, lineHeight: 16, paddingHorizontal: 6, marginTop: 5 },
  thumbnail: { width: 96, height: 72, borderRadius: 8, backgroundColor: colors.green, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  tileThumbnail: { width: '100%', height: 100, borderRadius: 0, marginBottom: 8 },
  details: { flex: 1, minWidth: 0 },
  title: { color: '#fff8e9', fontFamily: 'NunitoBold', fontSize: 13, lineHeight: 18, paddingHorizontal: 6 },
  subtitle: { color: colors.ember, fontFamily: 'NunitoSemiBold', fontSize: 11, marginTop: 6, paddingHorizontal: 6 },
});
