import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { reloadAppAsync } from 'expo';
import { router } from 'expo-router';
import { DEFAULT_COLORS, themeOptions } from './index';
import { useTheme } from './ThemeProvider';
import CustomColorPicker from './CustomColorPicker';

/** @param {{ onClose: () => void }} props */
export default function ThemePicker({ onClose }) {
  const { theme, selectTheme } = useTheme();
  const [selectedId, setSelectedId] = useState(/** @type {import('./ThemeProvider').ThemeId} */ (theme.id));
  const [color, setColor] = useState(theme.id === 'default' ? theme.colors.primary : '#182230');
  const [hex, setHex] = useState(theme.id === 'default' ? theme.colors.primary : '#182230');
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const [defaultExpanded, setDefaultExpanded] = useState(false);
  const [draftColor, setDraftColor] = useState(theme.id === 'default' ? theme.colors.primary : '#182230');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const insets = useSafeAreaInsets();
  const selectionColor = getContrastColor(theme.colors.primary);
  const updateColor = (next) => { setColor(next); setHex(next); };
  const apply = async () => {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError('');
    try {
      await selectTheme(selectedId, color);
      try { await reloadAppAsync('Theme changed'); } catch { /* route fallback below */ }
      // Some Expo hosts resolve reloadAppAsync without restarting the runtime.
      // Route to the intro as a visible fallback after the preference is saved.
      router.replace('/');
    } catch {
      setError('Could not save your theme. Please try again.');
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  const close = () => { if (!busy.current) onClose(); };
  return (
    <>
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={[styles.backdrop, { backgroundColor: theme.colors.tint, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessible={false} />
        <View accessibilityViewIsModal style={[styles.sheet, { backgroundColor: theme.colors.surfaceTint }]}>
          <View style={styles.header}>
            <Text accessibilityRole="header" style={[styles.title, { color: theme.colors.ink }]}>Choose your theme</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close theme picker" disabled={saving} onPress={close} style={styles.close}>
              <Ionicons name="close" size={24} color={theme.colors.ink} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={[styles.subtitle, { color: theme.colors.muted }]}>A new mood for every page, from your first hello to your next song.</Text>
            {themeOptions.map((option) => {
              const selected = selectedId === option.id;
              return (
                <Pressable key={option.id} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled: saving, ...(option.id === 'default' ? { expanded: defaultExpanded } : {}) }}
                  accessibilityLabel={`${option.name}${theme.id === option.id ? ', current theme' : ''}`}
                  disabled={saving} onPress={() => {
                    setSelectedId(/** @type {import('./ThemeProvider').ThemeId} */ (option.id));
                    setDefaultExpanded((expanded) => option.id === 'default' ? !expanded : false);
                  }}
                  style={({ pressed }) => [styles.option, { backgroundColor: theme.colors.surfaceTint, borderColor: selected ? selectionColor : theme.colors.surfaceBorder }, selected && styles.optionSelected, pressed && styles.pressed]}>
                  {option.id === 'default'
                    ? <View style={[styles.preview, { backgroundColor: color }]} />
                    : <Image source={option.assets.home} contentFit="cover" autoplay={false} style={styles.preview} />}
                  <View style={styles.optionBody}>
                    <View style={styles.optionHeading}>
                      <Text style={[styles.optionTitle, { color: theme.colors.ink }]}>{option.name}</Text>
                      {option.id === 'default' && <Ionicons name={defaultExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.ink} />}
                      <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={selected ? selectionColor : theme.colors.surfaceBorder} />
                    </View>
                    <Text style={[styles.description, { color: theme.colors.muted }]}>{option.description}</Text>
                    {theme.id === option.id && <Text style={[styles.current, { color: selectionColor }]}>Current theme</Text>}
                  </View>
                </Pressable>
              );
            })}
            {selectedId === 'default' && defaultExpanded && <View style={styles.colorPicker}>
              <Text style={[styles.optionTitle, { color: theme.colors.ink }]}>Choose a plain background color</Text>
              <View style={styles.swatches}>{DEFAULT_COLORS.map((item) => <Pressable key={item.name} accessibilityRole="radio" accessibilityLabel={item.name} accessibilityState={{ checked: color === item.color }} onPress={() => updateColor(item.color)} style={[styles.swatch, { backgroundColor: item.color }]}><Text style={{ color: ['#F2EBDD', '#AFC4A5', '#C9B8DC', '#A9CFE0'].includes(item.color) ? '#111' : '#fff', fontSize: 11 }}>{item.name}</Text></Pressable>)}</View>
              <Pressable accessibilityRole="button" accessibilityLabel="Open custom color picker" disabled={saving} onPress={() => { setDraftColor(color); setColorPickerVisible(true); }} style={({ pressed }) => [styles.openPicker, pressed && styles.pressed]}>
                <View style={[styles.pickerColorDot, { backgroundColor: color }]} />
                <Text style={styles.openPickerText}>Open custom color picker</Text>
                <Ionicons name="color-palette-outline" size={20} color="#543e70" />
              </Pressable>
              <Text style={styles.label}>Hex color</Text>
              <TextInput accessibilityLabel="Custom background hex color" value={hex} editable={!saving} maxLength={7} autoCapitalize="characters" autoCorrect={false} placeholder="#182230" style={styles.colorInput} onChangeText={(value) => { setHex(value); if (/^#[\da-f]{6}$/i.test(value)) setColor(value.toUpperCase()); }} />
              {!/^#[\da-f]{6}$/i.test(hex) && <Text accessibilityRole="alert" style={styles.error}>Enter a 6 digit hex color, such as #163D59.</Text>}
            </View>}
            <Text style={[styles.subtitle, { color: theme.colors.muted }]}>Applying a theme restarts the app and returns to the intro. Your custom home video stays selected.</Text>
            {error ? <Text accessibilityRole="alert" style={[styles.error, { color: theme.colors.accent }]}>{error}</Text> : null}
          </ScrollView>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving, busy: saving }} disabled={saving} onPress={apply}
            style={({ pressed }) => [styles.apply, { backgroundColor: theme.colors.primary }, (pressed || saving) && styles.pressed]}>
            {saving && <ActivityIndicator color={theme.colors.cream} />}
            <Text style={[styles.applyText, { color: theme.colors.cream }]}>{saving ? 'Restarting...' : 'Apply & restart'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
      <Modal visible={colorPickerVisible} transparent animationType="fade" onRequestClose={() => setColorPickerVisible(false)}>
        <View style={[styles.pickerBackdrop, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setColorPickerVisible(false)} accessible={false} />
          <View accessibilityViewIsModal style={styles.pickerSheet}>
            <View style={styles.header}>
              <Text accessibilityRole="header" style={styles.title}>Custom background color</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close color picker" onPress={() => setColorPickerVisible(false)} style={styles.close}>
                <Ionicons name="close" size={24} color="#241e30" />
              </Pressable>
            </View>
            <Text style={styles.pickerInstructions}>Drag inside the shade area and along the hue bar to choose your color.</Text>
            <CustomColorPicker color={draftColor} onChange={setDraftColor} disabled={saving} />
            <View style={styles.pickerActions}>
              <Pressable accessibilityRole="button" onPress={() => setColorPickerVisible(false)} style={[styles.pickerAction, styles.cancelPicker]}>
                <Text style={styles.cancelPickerText}>Cancel</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => { updateColor(draftColor); setColorPickerVisible(false); }} style={[styles.pickerAction, styles.confirmPicker]}>
                <Text style={styles.confirmPickerText}>Use this color</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function getContrastColor(hex) {
  const values = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  const linear = values.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  return luminance > 0.42 ? '#171717' : '#FFFFFF';
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, paddingHorizontal: 20, backgroundColor: 'rgba(16,8,24,0.78)', justifyContent: 'center', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 480, maxHeight: '100%', backgroundColor: '#fff7eb', borderRadius: 24, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { flex: 1, fontFamily: 'NunitoExtraBold', fontSize: 23, color: '#291b34' },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  content: { gap: 16, paddingBottom: 8 },
  subtitle: { color: '#655069', fontFamily: 'NunitoRegular', fontSize: 14, lineHeight: 21 },
  option: { borderWidth: 2, borderRadius: 18, overflow: 'hidden', backgroundColor: '#fffdf8' },
  optionSelected: { borderWidth: 3 },
  preview: { width: '100%', height: 100 },
  optionBody: { padding: 14, gap: 5 },
  optionHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionTitle: { flex: 1, fontFamily: 'NunitoExtraBold', fontSize: 19, color: '#291b34' },
  description: { fontFamily: 'NunitoRegular', fontSize: 14, lineHeight: 20, color: '#655069' },
  current: { fontFamily: 'NunitoBold', fontSize: 13, marginTop: 3 },
  apply: { minHeight: 50, borderRadius: 16, marginTop: 16, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  applyText: { color: '#fff1dc', fontFamily: 'NunitoExtraBold', fontSize: 16 },
  colorPicker: { gap: 12, padding: 14, borderRadius: 14, backgroundColor: '#ffffff88' },
  label: { color: '#241e30', fontSize: 14, fontWeight: '700' },
  openPicker: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: '#d1c8dc', backgroundColor: '#fff', marginTop: 4 },
  pickerColorDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: '#8a8191' },
  openPickerText: { flex: 1, color: '#302b36', fontSize: 14, fontWeight: '700' },
  pickerBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18, backgroundColor: 'rgba(16,8,24,0.82)' },
  pickerSheet: { width: '100%', maxWidth: 460, borderRadius: 24, padding: 20, gap: 12, backgroundColor: '#f8f5fb', borderWidth: 1, borderColor: '#ded6e7' },
  pickerInstructions: { color: '#5f5868', fontSize: 14, lineHeight: 20 },
  pickerActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  pickerAction: { minHeight: 48, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingHorizontal: 12 },
  cancelPicker: { backgroundColor: '#ece7f1' },
  cancelPickerText: { color: '#302b36', fontSize: 14, fontWeight: '700' },
  confirmPicker: { backgroundColor: '#543e70' },
  confirmPickerText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { minWidth: 74, minHeight: 42, borderRadius: 10, padding: 8, alignItems: 'center', justifyContent: 'center' },
  colorInput: { minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: '#777', padding: 12, color: '#241e30', backgroundColor: '#fff' },
  error: { color: '#a20d1b', fontSize: 14 },
  pressed: { opacity: 0.75 },
});

