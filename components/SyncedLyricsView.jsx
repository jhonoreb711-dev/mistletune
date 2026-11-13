import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { activeSegmentIndex } from './syncedLyricsUtils';

export default function SyncedLyricsView({ segments, currentTime, onSeek }) {
  const scroll = useRef(null);
  const offsets = useRef({});
  const [following, setFollowing] = useState(true);
  const [layoutRevision, setLayoutRevision] = useState(0);
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
});
