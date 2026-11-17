<<<<<<< HEAD
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { interpolateColor, runOnJS, useAnimatedReaction, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useKaraokeClock } from './useKaraokeClock';
import { DEFAULT_SYNC_OFFSET_MS, LOOKAHEAD_MS, lyricTapPositionMs, visibleLyricLine } from './karaokeTiming';
import { useThemeStyles } from '../themes/ThemeProvider';

export default function SyncedLyricsView({ segments, player, currentTime = 0, previewPosition = null, syncOffset = DEFAULT_SYNC_OFFSET_MS, onSeek }) {
  const { styles } = useThemeStyles(createStyles, BASE_COLORS);
=======
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { activeSegmentIndex } from './syncedLyricsUtils';

export default function SyncedLyricsView({ segments, currentTime, onSeek }) {
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
  const scroll = useRef(null);
  const offsets = useRef({});
  const [following, setFollowing] = useState(true);
  const [layoutRevision, setLayoutRevision] = useState(0);
<<<<<<< HEAD
  const [containerHeight, setContainerHeight] = useState(0);
  const [active, setActive] = useState(-1);
  const reducedMotion = useReducedMotion();
  // Keep visual compensation separate from the actual audio position.
  const { effectiveTimeMs } = useKaraokeClock(player, syncOffset, previewPosition, currentTime);

  // Line changes cross back to React only for scrolling the active line into view
  useAnimatedReaction(
    () => visibleLyricLine(segments, effectiveTimeMs.value),
    (next, previous) => { if (next !== previous) runOnJS(setActive)(next); },
    [segments],
  );

  // Auto-scroll when active line changes or when following is re-enabled
  const idleTimer = useRef(null);
  useEffect(() => () => clearTimeout(idleTimer.current), []);
  const recordOffset = useCallback((index, y) => {
    offsets.current[index] = y;
  }, []);

  const scrollToActive = useCallback((targetActive) => {
    if (targetActive < 0) return;
    let targetY = offsets.current[targetActive];
    if (targetY === undefined) {
      const knownKeys = Object.keys(offsets.current).map(Number);
      if (knownKeys.length > 0) {
        const maxKey = Math.max(...knownKeys);
        const maxY = offsets.current[maxKey];
        const avgHeight = maxY / Math.max(1, maxKey);
        targetY = targetActive * avgHeight;
      } else {
        targetY = targetActive * 64;
      }
    }
    const centerOffset = containerHeight > 0 ? containerHeight * 0.35 : 120;
    scroll.current?.scrollTo({ y: Math.max(0, targetY - centerOffset), animated: !reducedMotion });
  }, [containerHeight, reducedMotion]);

  useEffect(() => {
    if (following && active >= 0) {
      scrollToActive(active);
    }
  }, [active, following, layoutRevision, scrollToActive]);

  const handleScrollDrag = useCallback(() => {
    setFollowing(false);
    // Auto-resume following after 3.5s of no user scrolling so lyrics are never lost
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      setFollowing(true);
    }, 3500);
  }, []);

  const handleFollowPress = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    setFollowing(true);
    scrollToActive(active);
  }, [active, scrollToActive]);

  const handleContainerLayout = useCallback((e) => setContainerHeight(e.nativeEvent.layout.height), []);

  const dynamicPaddingBottom = useMemo(() => {
    return Math.max(320, containerHeight > 0 ? containerHeight * 0.7 : 320);
  }, [containerHeight]);

  return (
    <View style={styles.container} onLayout={handleContainerLayout}>
      <ScrollView
        ref={scroll}
        onScrollBeginDrag={handleScrollDrag}
        contentContainerStyle={[styles.content, { paddingBottom: dynamicPaddingBottom }]}
        showsVerticalScrollIndicator={false}
      >
        {segments.map((segment, index) => (
          <SegmentRow
            key={`${segment.start}:${index}`}
            segment={segment}
            index={index}
            isActive={index === active}
            isPast={index < active}
            animate={active < 0 ? index <= 2 : Math.abs(index - active) <= 2}
            effectiveTimeMs={effectiveTimeMs}
            reducedMotion={reducedMotion}
            onSeek={onSeek}
            syncOffset={syncOffset}
            setFollowing={setFollowing}
            recordOffset={recordOffset}
          />
        ))}
        <View onLayout={() => setLayoutRevision((r) => r + 1)} />
      </ScrollView>
      {!following && (
        <Pressable style={styles.follow} onPress={handleFollowPress}>
          <Text style={styles.followText}>Follow lyrics ↓</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Segment row ───────────────────────────────────────────────────────────────
const SegmentRow = memo(function SegmentRow({
  segment,
  index,
  isActive,
  isPast,
  animate,
  effectiveTimeMs,
  reducedMotion,
  onSeek,
  syncOffset,
  setFollowing,
  recordOffset,
}) {
  const { styles } = useThemeStyles(createStyles, BASE_COLORS);
  const handleLayout = useCallback(({ nativeEvent }) => recordOffset(index, nativeEvent.layout.y), [index, recordOffset]);
  const handlePress = useCallback(() => {
    onSeek(lyricTapPositionMs(segment.start * 1000, syncOffset, LOOKAHEAD_MS) / 1000);
    setFollowing(true);
  }, [segment.start, syncOffset, onSeek, setFollowing]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Seek to lyric: ${segment.text}`}
      onLayout={handleLayout}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.linePressable,
        !isActive && styles.inactiveLine,
        pressed && { opacity: 0.7 },
      ]}
    >
      {segment.words?.length ? (
        <View style={styles.words} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {groupWords(segment.words).map((chunk, chunkIndex, chunks) => {
            const nextChunk = chunks[chunkIndex + 1];
            const label = chunk.map((word) => word.word.trim()).join(' ');
            return animate ? (
              <GoldChunkWord
                key={chunkIndex}
                chunk={chunk}
                nextChunk={nextChunk}
                effectiveTimeMs={effectiveTimeMs}
                reducedMotion={reducedMotion}
              />
            ) : (
              <View key={chunkIndex} style={styles.chip}>
                <Text style={isPast ? styles.chipTextPast : styles.chipTextStatic}>
                  {label}
                </Text>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={[styles.line, isActive && styles.activeLine, isPast && styles.pastLine]}>
          {segment.text}
        </Text>
      )}
    </Pressable>
  );
});

// ── Chunking: highlight two-or-more words at a time ─────────────────────
// Singing word-by-word is frantic and exposes ASR timing jitter. Group words
// into pairs; an odd trailing word joins the previous chunk (3-word unit), so
// every unit holds at least two words unless the line has exactly one.
function groupWords(words) {
  const chunks = [];
  let current = [];
  for (const word of words) {
    current.push(word);
    if (current.length === 2) {
      chunks.push(current);
      current = [];
    }
  }
  if (current.length === 1 && chunks.length > 0) {
    chunks[chunks.length - 1] = [...chunks[chunks.length - 1], ...current];
  } else if (current.length > 0) {
    chunks.push(current);
  }
  return chunks;
}

// ── Gold chip active chunk highlighting with an animated transition ─────────
function GoldChunkWord({ chunk, effectiveTimeMs, reducedMotion }) {
  const { styles, colors } = useThemeStyles(createStyles, BASE_COLORS);
  const moss = colors.moss;
  const startMs = chunk[0].start * 1000;
  const chunkEndMs = chunk[chunk.length - 1].end * 1000;
  // End highlights at the measured vocal boundary, including instrumental gaps.
  const endMs = chunkEndMs;

  // 0..1 activation, driven by crossing the start/end thresholds — springs in,
  // fades out — instead of the chip snapping between states every word.
  const pop = useSharedValue(0);
  useAnimatedReaction(
    () => {
      const t = effectiveTimeMs.value;
      return t >= startMs && t < endMs;
    },
    (on, previous) => {
      if (on === previous) return;
      if (reducedMotion) {
        pop.value = on ? 1 : 0;
      } else {
        pop.value = on
          ? withTiming(1, { duration: 70 })
          : withTiming(0, { duration: 100 });
      }
    },
  );

  const label = chunk.map((word) => word.word.trim()).join(' ');

  const animatedChipStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(pop.value, [0, 1], ['rgba(244, 214, 131, 0)', '#f4d683']),

  }));

  const animatedTextStyle = useAnimatedStyle(() => {
    const t = effectiveTimeMs.value;
    if (t >= endMs) {
      return { color: '#f4d683', fontWeight: '700' };
    }
    return {
      color: interpolateColor(pop.value, [0, 1], [moss, '#000000']),
      fontWeight: pop.value > 0.5 ? '800' : '600',
    };
  });

  return (
    <Animated.View style={[styles.chip, animatedChipStyle]}>
      <Animated.Text style={[styles.chipText, animatedTextStyle]}>
        {label}
      </Animated.Text>
    </Animated.View>
  );
}

const BASE_COLORS = {
  moss: '#a3b89e',
  greenPanelAlt: '#103827',
};

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1 },
  content: { paddingTop: 28, paddingHorizontal: 4 },
  linePressable: { paddingVertical: 10, minHeight: 48 },
  inactiveLine: { opacity: 0.5 },
  words: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  chip: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
    marginVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipText: {
    fontSize: 28,
    lineHeight: 42,
  },
  chipTextStatic: {
    color: colors.moss,
    fontSize: 28,
    lineHeight: 42,
    fontWeight: '600',
  },
  chipTextPast: {
    color: '#f4d683',
    fontSize: 28,
    lineHeight: 42,
    fontWeight: '700',
  },
  line: { color: colors.moss, fontSize: 28, lineHeight: 46, fontWeight: '600' },
  activeLine: { color: '#f4d683', fontWeight: '800' },
  pastLine: { color: '#f4d683', fontWeight: '700' },
  follow: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    borderRadius: 24,
    paddingHorizontal: 22,
    minHeight: 48,
    justifyContent: 'center',
    backgroundColor: '#eed68a',
  },
  followText: { color: colors.greenPanelAlt, fontWeight: '800', fontSize: 14 },
=======
  const active = activeSegmentIndex(segments, currentTime);
  useEffect(() => {
    if (following && active >= 0 && offsets.current[active] !== undefined) {
      scroll.current?.scrollTo({ y: Math.max(0, offsets.current[active] - 90), animated: true });
    }
  }, [active, following, layoutRevision]);
  return <View style={styles.container}>
    <ScrollView ref={scroll} onScrollBeginDrag={() => setFollowing(false)} contentContainerStyle={styles.content}>
      {segments.map((segment, index) => <Pressable key={`${segment.start}:${index}`} accessibilityRole="button"
        accessibilityLabel={`Seek to lyric: ${segment.text}`} accessibilityState={{ selected: index === active }}
        onLayout={({ nativeEvent }) => { offsets.current[index] = nativeEvent.layout.y; }}
        onPress={() => { onSeek(segment.start); setFollowing(true); }}>
        <Text style={[styles.line, index === active ? styles.active : index < active ? styles.previous : null]}>{segment.text}</Text>
      </Pressable>)}
      <View onLayout={() => setLayoutRevision((revision) => revision + 1)} />
    </ScrollView>
    {!following && <Pressable style={styles.follow} onPress={() => setFollowing(true)}><Text style={styles.followText}>Follow lyrics ↓</Text></Pressable>}
  </View>;
}
const styles = StyleSheet.create({
  container: { flex: 1 }, content: { paddingTop: 20, paddingBottom: 180 },
  line: { fontSize: 30, lineHeight: 43, fontWeight: '800', color: '#78957e', paddingVertical: 9 },
  active: { color: '#fff9df' }, previous: { color: '#e0c66f' },
  follow: { position: 'absolute', bottom: 10, alignSelf: 'center', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#efd381' },
  followText: { color: '#153e2d', fontWeight: '800' },
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
});
