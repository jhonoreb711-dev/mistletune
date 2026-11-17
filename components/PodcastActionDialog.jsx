import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../themes/ThemeProvider';

export default function PodcastActionDialog(props) {
  return props.visible ? <DialogContent {...props} /> : null;
}

function DialogContent({ title, message, video, icon = 'trash-outline', destructive = false, confirmLabel = 'Delete', confirmDisabled = false, onConfirm, onClose, children }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const [progress] = useState(() => new Animated.Value(0));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const closing = useRef(false);
  const reduced = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    let active = true;
    mounted.current = true;
    const start = async () => {
      try { reduced.current = await AccessibilityInfo.isReduceMotionEnabled(); } catch { /* Use the standard transition if unavailable. */ }
      if (!active) return;
      if (reduced.current) progress.setValue(1);
      else Animated.spring(progress, { toValue: 1, damping: 22, stiffness: 220, mass: 0.85, useNativeDriver: true }).start();
    };
    start();
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      reduced.current = value;
      if (value) { progress.stopAnimation(); progress.setValue(1); }
    });
    return () => { active = false; mounted.current = false; progress.stopAnimation(); subscription.remove(); };
  }, [progress]);
  const close = () => {
    if (locked.current || closing.current) return;
    closing.current = true;
    if (reduced.current) { onClose(); return; }
    Animated.timing(progress, { toValue: 0, duration: 160, useNativeDriver: true }).start(({ finished }) => { if (finished && mounted.current) onClose(); });
  };
  const confirm = async () => {
    if (locked.current || closing.current || confirmDisabled) return;
    locked.current = true; setBusy(true); setError('');
    try {
      const result = await onConfirm();
      locked.current = false;
      if (mounted.current) { setBusy(false); if (result !== false) close(); }
    } catch (cause) {
      locked.current = false;
      if (mounted.current) { setBusy(false); setError(cause?.message || 'Could not save your changes. Please try again.'); }
    }
  };
  const artwork = video?.coverUri || video?.thumbnailUri;
  const actionColor = destructive ? '#b93349' : c.gold;
  return <Modal transparent animationType="none" visible onRequestClose={close} statusBarTranslucent>
    <View style={s.overlay}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000', opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.68] }) }]} />
      <Pressable style={StyleSheet.absoluteFillObject} onPress={close} accessibilityRole="button" accessibilityLabel="Dismiss dialog" disabled={busy} />
      <KeyboardAvoidingView pointerEvents="box-none" behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[s.position, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        <Animated.View accessibilityViewIsModal style={[s.card, { backgroundColor: c.surfaceDeep, borderColor: c.surfaceBorder, opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }, { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }]}>
          <View style={{ height: 4, backgroundColor: c.gold }} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.body}>
            <View style={s.row}>
              <View style={[s.badge, { backgroundColor: c.surfaceRaised, borderColor: c.surfaceBorder }]}><Ionicons name={theme.icon || 'musical-notes-outline'} size={14} color={c.gold} /><Text style={[s.eyebrow, { color: c.gold }]}>MISTLETUNES</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close dialog" disabled={busy} onPress={close} style={s.close}><Ionicons name="close" size={22} color={c.onSurfaceMuted} /></Pressable>
            </View>
            <View style={[s.symbol, { backgroundColor: c.surfaceRaised, borderColor: c.surfaceBorder }]}><Ionicons name={icon} size={30} color={c.gold} /></View>
            <Text accessibilityRole="header" style={[s.title, { color: c.cream }]}>{title}</Text>
            <Text style={[s.message, { color: c.onSurfaceMuted }]}>{message}</Text>
            {video && <View style={[s.preview, { backgroundColor: c.surfaceRaised, borderColor: c.surfaceBorder }]}>
              {artwork ? <Image source={{ uri: artwork }} contentFit="cover" style={s.artwork} /> : <View style={[s.artwork, s.placeholder, { backgroundColor: c.surface }]}><Ionicons name="videocam-outline" size={23} color={c.gold} /></View>}
              <View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={2} style={[s.videoTitle, { color: c.cream }]}>{video.title || video.name || 'Podcast video'}</Text><Text numberOfLines={1} style={[s.caption, { color: c.onSurfaceMuted }]}>{video.episodeNumber ? 'Episode ' + video.episodeNumber : 'Podcast'}{video.podcastTitle ? ' ? ' + video.podcastTitle : ''}</Text></View>
            </View>}
            {children}
            {error ? <Text accessibilityLiveRegion="polite" style={s.error}>{error}</Text> : null}
            <View style={s.actions}>
              <Pressable accessibilityRole="button" disabled={busy} onPress={close} style={({ pressed }) => [s.button, { backgroundColor: c.surfaceRaised, borderColor: c.surfaceBorder, borderWidth: 1, opacity: busy ? 0.5 : pressed ? 0.75 : 1 }]}><Text style={[s.buttonText, { color: c.cream }]}>Cancel</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || confirmDisabled, busy }} disabled={busy || confirmDisabled} onPress={confirm} style={({ pressed }) => [s.button, { backgroundColor: actionColor, opacity: busy || confirmDisabled ? 0.6 : pressed ? 0.8 : 1 }]}>{busy ? <ActivityIndicator color={destructive ? '#fff' : c.surfaceDeep} /> : <Ionicons name={icon} size={18} color={destructive ? '#fff' : c.surfaceDeep} />}<Text style={[s.buttonText, { color: destructive ? '#fff' : c.surfaceDeep }]}>{busy ? 'Please wait?' : confirmLabel}</Text></Pressable>
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  </Modal>;
}
const s = StyleSheet.create({
  overlay: { flex: 1 }, position: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 22 },
  card: { width: '100%', maxWidth: 420, maxHeight: '100%', borderWidth: 1, borderRadius: 26, overflow: 'hidden', elevation: 12, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } },
  body: { padding: 22 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, badge: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, borderWidth: 1 }, eyebrow: { fontFamily: 'NunitoExtraBold', fontSize: 10, letterSpacing: 1.3 }, close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  symbol: { width: 66, height: 66, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 12, marginBottom: 17 }, title: { fontFamily: 'NunitoExtraBold', fontSize: 25, marginBottom: 8 }, message: { fontFamily: 'NunitoRegular', fontSize: 14, lineHeight: 21 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, marginTop: 20, borderWidth: 1, borderRadius: 17 }, artwork: { width: 54, height: 54, borderRadius: 12 }, placeholder: { alignItems: 'center', justifyContent: 'center' }, videoTitle: { fontFamily: 'NunitoBold', fontSize: 14 }, caption: { fontFamily: 'NunitoRegular', fontSize: 11, marginTop: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 24 }, button: { flexGrow: 1, flexBasis: 110, minHeight: 50, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, buttonText: { fontFamily: 'NunitoExtraBold', fontSize: 14 }, error: { color: '#ffadb9', fontFamily: 'NunitoSemiBold', fontSize: 13, marginTop: 14 },
});
