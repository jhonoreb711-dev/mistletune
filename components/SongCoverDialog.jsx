import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SongArtwork from './SongArtwork';
import { useThemeStyles } from '../themes/ThemeProvider';

export default function SongCoverDialog({ track, busy, error, onClose, onChange, onRemove }) {
  const { styles, colors: COLORS } = useThemeStyles(createStyles, BASE_COLORS);
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={Boolean(track)} transparent animationType="fade" statusBarTranslucent onRequestClose={() => { if (!busy) onClose(); }}>
      <View style={[styles.backdrop, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        <Pressable accessibilityLabel="Close song cover dialog" disabled={busy} onPress={onClose} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={styles.sheet}>
          <View style={styles.ribbon}><Text style={styles.ribbonText}>✦  MISTLETUNES  ✦</Text></View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <View style={styles.heading}>
              <View style={styles.headingIcon}><Ionicons name="image-outline" size={22} color={COLORS.ember} /></View>
              <View style={{ flex: 1 }}><Text style={styles.title}>Song cover</Text><Text style={styles.subtitle}>Give your music a personal touch</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" disabled={busy} hitSlop={8} onPress={onClose} style={styles.close}><Ionicons name="close" size={20} color="#fff8e9" /></Pressable>
            </View>
            <View style={styles.previewRow}>
              <SongArtwork source={track?.artwork} contentFit="contain" iconSize={38} style={styles.preview} />
              <View style={{ flex: 1, gap: 5 }}>
                <Text numberOfLines={2} style={styles.songTitle}>{track?.title}</Text>
                <Text numberOfLines={1} style={styles.artist}>{track?.artist || 'Unknown artist'}</Text>
                <Text style={styles.caption}>Choose an image for this song.</Text>
              </View>
            </View>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            <Pressable accessibilityRole="button" disabled={busy} onPress={onChange} style={({ pressed }) => [styles.primary, (busy || pressed) && { opacity: 0.7 }]}>
              {busy ? <ActivityIndicator color={COLORS.green} /> : <Ionicons name="image-outline" size={21} color={COLORS.green} />}
              <Text style={styles.primaryText}>{busy ? 'Updating cover…' : track?.artwork ? 'Change cover' : 'Add cover'}</Text>
              {!busy && <Ionicons name="chevron-forward" size={18} color={COLORS.green} />}
            </Pressable>
            {track?.artwork ? <Pressable accessibilityRole="button" disabled={busy} onPress={onRemove} style={({ pressed }) => [styles.remove, pressed && { opacity: 0.7 }]}><Ionicons name="trash-outline" size={18} color="#ffb6b2" /><Text style={styles.removeText}>Remove cover</Text></Pressable> : null}
            <Pressable accessibilityRole="button" disabled={busy} onPress={onClose} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const BASE_COLORS = { green: '#163e2d', red: '#8e1420', greenDeep: '#0b2d20', greenPanelAlt: '#123d2c', ember: '#f4c86a' };

const createStyles = (colors) => StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, backgroundColor: colors.tint },
  sheet: { width: '100%', maxWidth: 420, maxHeight: '100%', borderRadius: 24, borderWidth: 1.5, borderColor: '#d7ad56', backgroundColor: colors.greenDeep, overflow: 'hidden', elevation: 12 },
  ribbon: { backgroundColor: colors.red, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#d7ad56' },
  ribbonText: { color: colors.ember, fontFamily: 'NunitoExtraBold', fontSize: 10, letterSpacing: 2 },
  content: { padding: 20, gap: 16 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headingIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(244,200,106,0.1)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff8e9', fontFamily: 'NunitoExtraBold', fontSize: 22 },
  subtitle: { color: '#d8c8a3', fontFamily: 'NunitoSemiBold', fontSize: 11, marginTop: 2 },
  close: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(244,200,106,0.25)', backgroundColor: colors.greenPanelAlt },
  preview: { width: 76, height: 76, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.greenDeep },
  songTitle: { color: '#fff8e9', fontFamily: 'NunitoBold', fontSize: 14 },
  artist: { color: colors.ember, fontFamily: 'NunitoSemiBold', fontSize: 11 },
  caption: { color: '#d8c8a3', fontFamily: 'NunitoRegular', fontSize: 11, lineHeight: 16 },
  primary: { minHeight: 52, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, padding: 12, backgroundColor: colors.ember },
  primaryText: { flex: 1, color: colors.green, fontFamily: 'NunitoExtraBold', fontSize: 15 },
  remove: { minHeight: 46, flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(142,20,32,0.3)', borderWidth: 1, borderColor: 'rgba(255,182,178,0.3)', borderRadius: 14 },
  removeText: { color: '#ffb6b2', fontFamily: 'NunitoBold', fontSize: 13 },
  cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#ded1b5', fontFamily: 'NunitoBold', fontSize: 13 },
  error: { color: '#ffb6b2', fontFamily: 'NunitoSemiBold', fontSize: 12, lineHeight: 18 },
});
