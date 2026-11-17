import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureDetector, GestureHandlerRootView, useNativeGesture } from 'react-native-gesture-handler';
import { usePlayback } from './PlaybackContext';
import QueueSwipeRow from './QueueSwipeRow';
import QueueSongPicker from './QueueSongPicker';
import { useThemeStyles } from '../themes/ThemeProvider';

// Row pitch for drag math (row height 66 + 6px margin).
const ROW_HEIGHT = 72;

// Bottom sheet listing the play queue. Rows can be dragged by their handle to
// reorder the play order; the native playlist re-creates itself and the
// playing track resumes at the same position (see PlaybackContext.reorderQueue).
export default function QueueSheet() {
  const { styles, colors: COLORS } = useThemeStyles(createStyles, BASE_COLORS);
  const { queueOpen, closeQueueSheet, queueTracks, queueKind, tracks, currentTrack, playing, playQueue, reorderQueue, removeFromQueue, addToQueue } = usePlayback();
  const [addingSongs, setAddingSongs] = useState(false);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const translateY = useState(() => new Animated.Value(height))[0];

  const slideIn = useCallback(() => {
    setAddingSongs(false);
    translateY.setValue(height);
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 2 }).start();
  }, [translateY, height]);

  return (
    <Modal visible={queueOpen} transparent animationType="none" onRequestClose={() => addingSongs ? setAddingSongs(false) : closeQueueSheet()} onShow={slideIn} statusBarTranslucent hardwareAccelerated>
      <GestureHandlerRootView style={styles.scrimWrap}>
        <Pressable style={styles.scrim} accessibilityRole="button" accessibilityLabel="Close queue" onPress={closeQueueSheet} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY }], paddingBottom: Math.max(insets.bottom, 10) }]}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <View style={styles.headerIcon}><Ionicons name="list" size={17} color={COLORS.green} /></View>
            <Text style={styles.title}>{addingSongs ? 'Add songs' : 'Up Next'}</Text>
            <Text style={styles.count}>{queueTracks.length} {queueTracks.length === 1 ? 'song' : 'songs'}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close queue" onPress={closeQueueSheet} hitSlop={12} style={styles.closeButton}>
              <Ionicons name="chevron-down" size={24} color="#f6ebcc" />
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={addingSongs ? 'Back to queue' : 'Add songs to queue'}
            onPress={() => setAddingSongs((value) => !value)}
            style={({ pressed }) => [styles.addSongsButton, pressed && styles.buttonPressed]}
          >
            <Ionicons name={addingSongs ? 'arrow-back' : 'add'} size={20} color={COLORS.green} />
            <Text style={styles.addSongsLabel}>{addingSongs ? 'Back to queue' : 'Add songs'}</Text>
          </Pressable>
          {addingSongs ? (
            <QueueSongPicker tracks={tracks} queueTracks={queueTracks} onAdd={addToQueue} />
          ) : <>
          <Text style={styles.hint}>Swipe left or right to remove a song · drag the dots to reorder</Text>
          {queueTracks.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="musical-notes-outline" size={44} color="#e8cf8a" />
              <Text style={styles.emptyTitle}>Nothing queued yet</Text>
              <Text style={styles.emptyNote}>Tap Add songs to choose from your library.</Text>
            </View>
          ) : (
            <QueueReorderList
              tracks={queueTracks}
              currentTrackId={currentTrack?.id ?? null}
              playing={queueOpen && playing}
              onPlay={(track) => playQueue(queueTracks, track, null, queueKind)}
              onReorder={reorderQueue}
              onRemove={removeFromQueue}
            />
          )}
          </>}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function QueueReorderList({ tracks, currentTrackId, playing, onPlay, onReorder, onRemove }) {
  const { styles } = useThemeStyles(createStyles, BASE_COLORS);
  const scrollGesture = useNativeGesture();
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dragging, setDragging] = useState(false);
  const [dropAnimating, setDropAnimating] = useState(false);
  const [swipingId, setSwipingId] = useState(null);
  const [activeTranslateY] = useState(() => new Animated.Value(0));
  const [activeScale] = useState(() => new Animated.Value(1));
  const gestureState = useRef({ activeIndex: -1, hoverIndex: -1, isDropping: false });
  const tracksRef = useRef(tracks);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);

  const animMap = useMemo(() => {
    const map = {};
    for (const track of tracks) map[track.id] = new Animated.Value(0);
    return map;
  }, [tracks]);

  const updateOthers = useCallback((from, hover) => {
    tracksRef.current.forEach((track, index) => {
      if (index === from) return;
      let target = 0;
      if (hover > from) {
        if (index > from && index <= hover) target = -ROW_HEIGHT;
      } else if (hover < from) {
        if (index >= hover && index < from) target = ROW_HEIGHT;
      }
      Animated.spring(animMap[track.id], { toValue: target, useNativeDriver: true, speed: 26, bounciness: 2 }).start();
    });
  }, [animMap]);

  const startDrag = useCallback((index) => {
    const state = gestureState.current;
    if (state.isDropping) return;
    state.activeIndex = index;
    state.hoverIndex = index;
    setDragging(true);
    setActiveIndex(index);
    activeTranslateY.setValue(0);
    Animated.spring(activeScale, { toValue: 1.03, useNativeDriver: true, speed: 28, bounciness: 4 }).start();
  }, [activeScale, activeTranslateY]);

  const moveDrag = useCallback((dy) => {
    const state = gestureState.current;
    if (state.isDropping || state.activeIndex < 0) return;
    const size = tracksRef.current.length;
    const min = -state.activeIndex * ROW_HEIGHT;
    const max = (size - 1 - state.activeIndex) * ROW_HEIGHT;
    const clamped = Math.max(min, Math.min(max, dy));
    activeTranslateY.setValue(clamped);
    const step = Math.round(clamped / ROW_HEIGHT);
    const hover = Math.max(0, Math.min(state.activeIndex + step, size - 1));
    if (hover !== state.hoverIndex) {
      state.hoverIndex = hover;
      updateOthers(state.activeIndex, hover);
    }
  }, [activeTranslateY, updateOthers]);

  const endDrag = useCallback((cancelled = false) => {
    const state = gestureState.current;
    const from = state.activeIndex;
    const hover = state.hoverIndex;
    if (from < 0 || state.isDropping) return;
    state.isDropping = true;
    setDropAnimating(true);
    const toValue = cancelled ? 0 : (hover - from) * ROW_HEIGHT;
    Animated.parallel([
      Animated.spring(activeTranslateY, { toValue, useNativeDriver: true, speed: 28, bounciness: 0 }),
      Animated.timing(activeScale, { toValue: 1, duration: 130, useNativeDriver: true }),
    ]).start(() => {
      if (!cancelled && hover !== from && from >= 0 && hover >= 0) onReorder?.(from, hover);
      tracksRef.current.forEach((track) => animMap[track.id]?.setValue(0));
      activeTranslateY.setValue(0);
      setActiveIndex(-1);
      setDragging(false);
      setDropAnimating(false);
      state.activeIndex = -1;
      state.hoverIndex = -1;
      state.isDropping = false;
    });
  }, [activeScale, activeTranslateY, animMap, onReorder]);

  return (
    <GestureDetector gesture={scrollGesture}>
    <ScrollView style={styles.list} contentContainerStyle={styles.listContent} scrollEnabled={!dragging && !dropAnimating} showsVerticalScrollIndicator={false}>
      {tracks.map((track, index) => {
        const isCurrent = track.id === currentTrackId;
        const isActive = index === activeIndex;
        const rowTransform = isActive
          ? [{ translateY: activeTranslateY }, { scale: activeScale }]
          : [{ translateY: animMap[track.id] ?? 0 }];
        return (
          <Animated.View
            key={track.id}
            style={[styles.rowWrap, isActive && styles.rowDragging, { transform: rowTransform }]}
          >
            <QueueSwipeRow
              styles={styles}
              scrollGesture={scrollGesture}
              track={track}
              isCurrent={isCurrent}
              playing={playing && isCurrent}
              indexLabel={index + 1}
              enabled={!dragging && !dropAnimating && (swipingId === null || swipingId === track.id)}
              onPlay={() => onPlay?.(track)}
              onRemove={() => onRemove?.(track.id)}
              onSwipingChange={(active) => setSwipingId((current) => active ? track.id : current === track.id ? null : current)}
              dragHandle={<QueueDragHandle enabled={swipingId === null && !dropAnimating} index={index} onDragStart={startDrag} onDragMove={moveDrag} onDragEnd={() => endDrag(false)} onDragCancel={() => endDrag(true)} track={track} isActive={isActive} />}
            />
          </Animated.View>
        );
      })}
    </ScrollView>
    </GestureDetector>
  );
}

function QueueDragHandle({ enabled, index, track, isActive, onDragStart, onDragMove, onDragEnd, onDragCancel }) {
  const { styles } = useThemeStyles(createStyles, BASE_COLORS);
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => enabled,
    onMoveShouldSetPanResponder: () => enabled,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => onDragStart(index),
    onPanResponderMove: (_event, gesture) => onDragMove(gesture.dy),
    onPanResponderRelease: () => onDragEnd(),
    onPanResponderTerminate: () => onDragCancel(),
  }), [enabled, index, onDragCancel, onDragEnd, onDragMove, onDragStart]);

  return (
    <View
      {...panResponder.panHandlers}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`Drag to reorder ${track.title}`}
      accessibilityHint="Drag up or down to change the play order"
      style={[styles.dragHandle, isActive && styles.dragHandleActive]}
    >
      <View style={styles.dragDotsColumn}>
        {[0, 1, 2].map((dot) => <View key={dot} style={[styles.dragDot, isActive && styles.dragDotActive]} />)}
      </View>
      <View style={styles.dragDotsColumn}>
        {[0, 1, 2].map((dot) => <View key={dot} style={[styles.dragDot, isActive && styles.dragDotActive]} />)}
      </View>
    </View>
  );
}

const BASE_COLORS = {
  green: '#15362a',
  greenDark: '#123527',
  greenPanelAlt: '#173e2d',
  greenDeep: '#0b241c',
  moss: '#a8bda5',
  ember: '#f4c86a',
};

const createStyles = (colors) => StyleSheet.create({
  scrimWrap: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.tint },
  sheet: { width: '100%', height: '68%', borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: colors.greenDark, borderWidth: 1, borderColor: 'rgba(244, 200, 106, 0.35)', paddingHorizontal: 16, paddingTop: 8 },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(246, 235, 204, 0.35)', marginBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6, paddingHorizontal: 2 },
  headerIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ember },
  title: { color: '#fff8e9', fontFamily: 'NunitoExtraBold', fontSize: 19 },
  count: { flex: 1, color: colors.moss, fontFamily: 'NunitoSemiBold', fontSize: 13, marginLeft: 2 },
  closeButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  hint: { color: colors.moss, fontFamily: 'NunitoSemiBold', fontSize: 12, paddingHorizontal: 2, paddingTop: 2, paddingBottom: 8 },
  addSongsButton: { minHeight: 48, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: 24, backgroundColor: colors.ember, marginVertical: 8 },
  addSongsLabel: { color: colors.green, fontFamily: 'NunitoBold', fontSize: 14 },
  buttonPressed: { opacity: 0.75 },
  list: { flex: 1 },
  listContent: { paddingBottom: 18, paddingTop: 2 },
  rowWrap: { marginBottom: 6 },
  rowDragging: { zIndex: 99, elevation: 12 },
  rowContainer: { height: 66, borderRadius: 14, overflow: 'hidden' },
  row: { height: 66, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, borderRadius: 14, backgroundColor: colors.greenDark, borderWidth: 1, borderColor: 'transparent' },
  rowNowPlaying: { backgroundColor: colors.greenPanelAlt, borderColor: 'rgba(244, 200, 106, 0.55)' },
  rowPlayArea: { flex: 1, minWidth: 0, height: '100%', flexDirection: 'row', alignItems: 'center', gap: 11 },
  rowNumber: { width: 22, textAlign: 'center', color: colors.moss, fontFamily: 'NunitoBold', fontSize: 14 },
  artwork: { width: 42, height: 42, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.greenDeep },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: '#e8dfc8', fontFamily: 'NunitoSemiBold', fontSize: 14 },
  rowTitleNowPlaying: { color: colors.ember, fontFamily: 'NunitoBold' },
  rowArtist: { color: colors.moss, fontFamily: 'NunitoRegular', fontSize: 11, marginTop: 2 },
  dragHandle: { width: 40, height: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  dragHandleActive: {},
  dragDotsColumn: { gap: 5 },
  dragDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.moss },
  dragDotActive: { backgroundColor: colors.ember },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 42, gap: 8 },
  emptyTitle: { color: '#fff8e9', fontFamily: 'NunitoExtraBold', fontSize: 17 },
  emptyNote: { color: colors.moss, fontFamily: 'NunitoRegular', fontSize: 12, textAlign: 'center', lineHeight: 17, paddingHorizontal: 38 },
});
