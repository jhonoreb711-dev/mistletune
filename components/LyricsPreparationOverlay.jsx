import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
<<<<<<< HEAD
import { useThemeStyles } from '../themes/ThemeProvider';

export default function LyricsPreparationOverlay({ state, onCancel, onSkip }) {
  const { styles } = useThemeStyles(createStyles, BASE_COLORS);
=======

export default function LyricsPreparationOverlay({ state, onCancel, onSkip }) {
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
  if (!state) return null;
  return <Modal transparent visible animationType="fade" onRequestClose={onCancel}>
    <View style={styles.backdrop}><View style={styles.card}>
      <View style={styles.icon}><Ionicons name="musical-notes" size={30} color="#f3d47e" /></View>
<<<<<<< HEAD
      <Text style={styles.title}>{state.error ? 'Could not prepare lyrics' : 'Getting lyrics ready…'}</Text>
=======
      <Text style={styles.title}>{state.error ? 'Lyrics could not be generated' : 'Generating offline lyrics…'}</Text>
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
      <Text style={styles.track} numberOfLines={2}>{state.title}</Text>
      <Text style={styles.detail}>{state.error || state.stage}</Text>
      {!state.error && <>
        <ActivityIndicator color="#f3d47e" style={styles.spinner} />
        <View style={styles.progress}><View style={[styles.fill, { width: `${Math.round(state.progress * 100)}%` }]} /></View>
<<<<<<< HEAD
        <Text style={styles.note}>Getting lyrics ready for this song. Once saved, they will show instantly on future plays.</Text>
=======
        <Text style={styles.note}>First play can take several minutes. Saved lyrics load automatically on future plays. Keep the app open.</Text>
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
      </>}
      <Pressable accessibilityRole="button" style={styles.primary} onPress={onSkip}><Text style={styles.primaryText}>Play without lyrics</Text></Pressable>
      <Pressable accessibilityRole="button" style={styles.secondary} onPress={onCancel}><Text style={styles.secondaryText}>Cancel</Text></Pressable>
    </View></View>
  </Modal>;
}
<<<<<<< HEAD
const BASE_COLORS = {
  green: '#1f5340',
  greenPanelAlt: '#103d2e',
  moss: '#e1e9df',
};

const createStyles = (colors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', padding: 26 },
  card: { backgroundColor: colors.greenPanelAlt, borderColor: '#b69b51', borderWidth: 1, borderRadius: 26, padding: 24 },
  icon: { alignSelf: 'center', padding: 15, borderRadius: 40, backgroundColor: colors.green, marginBottom: 16 },
  title: { fontSize: 21, fontWeight: '800', color: '#fff8df', textAlign: 'center' },
  track: { color: '#f3d47e', textAlign: 'center', marginTop: 12, fontWeight: '600' },
  detail: { color: colors.moss, textAlign: 'center', marginTop: 14, lineHeight: 21 },
  spinner: { marginVertical: 16 }, progress: { height: 5, borderRadius: 3, backgroundColor: colors.surface, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#f3d47e' },
  note: { color: '#a6bfb0', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 12 },
  primary: { backgroundColor: '#f3d47e', padding: 14, borderRadius: 18, marginTop: 22 },
  primaryText: { color: colors.greenPanelAlt, textAlign: 'center', fontWeight: '800' },
=======
const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00160dcc', justifyContent: 'center', padding: 26 },
  card: { backgroundColor: '#103d2e', borderColor: '#b69b51', borderWidth: 1, borderRadius: 26, padding: 24 },
  icon: { alignSelf: 'center', padding: 15, borderRadius: 40, backgroundColor: '#1f5340', marginBottom: 16 },
  title: { fontSize: 21, fontWeight: '800', color: '#fff8df', textAlign: 'center' },
  track: { color: '#f3d47e', textAlign: 'center', marginTop: 12, fontWeight: '600' },
  detail: { color: '#e1e9df', textAlign: 'center', marginTop: 14, lineHeight: 21 },
  spinner: { marginVertical: 16 }, progress: { height: 5, borderRadius: 3, backgroundColor: '#285541', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#f3d47e' },
  note: { color: '#a6bfb0', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 12 },
  primary: { backgroundColor: '#f3d47e', padding: 14, borderRadius: 18, marginTop: 22 },
  primaryText: { color: '#103d2e', textAlign: 'center', fontWeight: '800' },
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
  secondary: { padding: 14 }, secondaryText: { textAlign: 'center', color: '#e2e8db' },
});
