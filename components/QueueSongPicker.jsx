import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SongArtwork from './SongArtwork';
import { availableQueueTracks } from './queueUtils';
import { useThemeStyles } from '../themes/ThemeProvider';

const BASE_COLORS = { greenDeep: '#0b241c', greenPanelAlt: '#173e2d', moss: '#a8bda5', ember: '#f4c86a' };

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1 },
  search: { minHeight: 48, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.greenDeep, color: '#fff8e9', fontSize: 16, fontFamily: 'NunitoRegular' },
  note: { color: colors.moss, fontSize: 13, fontFamily: 'NunitoSemiBold', marginVertical: 10 },
  list: { paddingBottom: 20 },
  row: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: 12, marginBottom: 6 },
  pressed: { backgroundColor: colors.greenPanelAlt },
  artwork: { width: 42, height: 42, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.greenDeep },
  text: { flex: 1, minWidth: 0 },
  title: { color: '#e8dfc8', fontFamily: 'NunitoSemiBold', fontSize: 14 },
  artist: { color: colors.moss, fontFamily: 'NunitoRegular', fontSize: 12, marginTop: 2 },
  empty: { color: colors.moss, fontFamily: 'NunitoSemiBold', fontSize: 14, textAlign: 'center', paddingVertical: 28, paddingHorizontal: 16 },
});

export default function QueueSongPicker({ tracks, queueTracks, onAdd }) {
  const { styles, colors: COLORS } = useThemeStyles(createStyles, BASE_COLORS);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const available = useMemo(() => availableQueueTracks(tracks, queueTracks, query), [tracks, queueTracks, query]);

  return (
    <View style={styles.container}>
      <TextInput
        accessibilityLabel="Search songs to add"
        placeholder="Search title or artist"
        placeholderTextColor={COLORS.moss}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        returnKeyType="search"
        style={styles.search}
      />
      <Text style={styles.note} accessibilityLiveRegion="polite">{message || 'Tap a song to add it to the end of the queue.'}</Text>
      <FlatList
        data={available}
        keyExtractor={(track) => String(track.id)}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add ${item.title} by ${item.artist || 'Unknown artist'} to queue`}
            onPress={() => setMessage(onAdd(item) ? `Added ${item.title}` : 'Could not add this song. Please try again.')}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <SongArtwork source={item.artwork} style={styles.artwork} iconSize={18} />
            <View style={styles.text}>
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.artist} numberOfLines={1}>{item.artist || 'Unknown artist'}</Text>
            </View>
            <Ionicons name="add-circle-outline" size={26} color={COLORS.ember} />
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>{query.trim() ? 'No matching songs outside your queue.' : tracks.length ? 'All available songs are already in your queue.' : 'Your library is empty. Add music in Library first.'}</Text>
        }
      />
    </View>
  );
}
