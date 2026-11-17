import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

const HUES = ['#ff0000', '#ff00ff', '#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff0000'];

export default function CustomColorPicker({ color, onChange, disabled }) {
  const [fieldSize, setFieldSize] = useState({ width: 1, height: 1 });
  const [hueWidth, setHueWidth] = useState(1);
  const hsv = hexToHsv(color);
  const hueColor = hsvToHex({ h: hsv.h, s: 1, v: 1 });

  const setFromField = (x, y) => {
    const s = clamp(x / fieldSize.width);
    const v = 1 - clamp(y / fieldSize.height);
    onChange(hsvToHex({ ...hsv, s, v }));
  };
  const setFromHue = (x) => onChange(hsvToHex({ ...hsv, h: clamp(x / hueWidth) * 360 }));

  return (
    <View style={styles.container}>
      <View style={styles.previewRow}>
        <View style={[styles.colorChip, { backgroundColor: color }]} />
        <View style={styles.previewCopy}>
          <Text style={styles.previewTitle}>Custom color</Text>
          <Text style={styles.previewValue}>{color.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={styles.label}>Shade</Text>
      <View
        accessibilityRole="adjustable"
        accessibilityLabel={`Color shade, ${color}`}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(hsv.v * 100) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => onChange(hsvToHex({ ...hsv, v: clamp(hsv.v + (event.nativeEvent.actionName === 'increment' ? 0.05 : -0.05)) }))}
        onLayout={(event) => setFieldSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
        onStartShouldSetResponder={() => !disabled}
        onMoveShouldSetResponder={() => !disabled}
        onResponderGrant={(event) => setFromField(event.nativeEvent.locationX, event.nativeEvent.locationY)}
        onResponderMove={(event) => setFromField(event.nativeEvent.locationX, event.nativeEvent.locationY)}
        style={styles.shadeField}
      >
        <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="shadeWhite" x1="0%" y1="0%" x2="100%" y2="0%"><Stop offset="0%" stopColor="#fff" /><Stop offset="100%" stopColor="#fff" stopOpacity="0" /></LinearGradient>
            <LinearGradient id="shadeBlack" x1="0%" y1="0%" x2="0%" y2="100%"><Stop offset="0%" stopColor="#000" stopOpacity="0" /><Stop offset="100%" stopColor="#000" /></LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={hueColor} />
          <Rect width="100%" height="100%" fill="url(#shadeWhite)" />
          <Rect width="100%" height="100%" fill="url(#shadeBlack)" />
        </Svg>
        <View pointerEvents="none" style={[styles.shadeMarker, { left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }]} />
      </View>
      <Text style={styles.label}>Hue</Text>
      <View
        accessibilityRole="adjustable"
        accessibilityLabel={`Hue, ${Math.round(hsv.h)} degrees`}
        accessibilityValue={{ min: 0, max: 360, now: Math.round(hsv.h) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => onChange(hsvToHex({ ...hsv, h: (hsv.h + (event.nativeEvent.actionName === 'increment' ? 5 : 355)) % 360 }))}
        onLayout={(event) => setHueWidth(event.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => !disabled}
        onMoveShouldSetResponder={() => !disabled}
        onResponderGrant={(event) => setFromHue(event.nativeEvent.locationX)}
        onResponderMove={(event) => setFromHue(event.nativeEvent.locationX)}
        style={styles.hueTrack}
      >
        <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs><LinearGradient id="rainbowHue" x1="0%" y1="0%" x2="100%" y2="0%">{HUES.map((hue, index) => <Stop key={hue + index} offset={`${index / (HUES.length - 1) * 100}%`} stopColor={hue} />)}</LinearGradient></Defs>
          <Rect width="100%" height="100%" rx="10" fill="url(#rainbowHue)" />
        </Svg>
        <View pointerEvents="none" style={[styles.hueMarker, { left: `${hsv.h / 360 * 100}%` }]} />
      </View>
      <Text style={styles.hint}>Drag in the shade panel, then drag the hue bar to fine-tune.</Text>
    </View>
  );
}

function hexToHsv(hex) {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

function hsvToHex({ h, s, v }) {
  const chroma = v * s;
  const x = chroma * (1 - Math.abs((h / 60) % 2 - 1));
  const m = v - chroma;
  const rgb = h < 60 ? [chroma, x, 0] : h < 120 ? [x, chroma, 0] : h < 180 ? [0, chroma, x] : h < 240 ? [0, x, chroma] : h < 300 ? [x, 0, chroma] : [chroma, 0, x];
  return '#' + rgb.map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

const clamp = (value) => Math.max(0, Math.min(1, value));

const styles = StyleSheet.create({
  container: { gap: 10 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: '#ffffffb8', borderWidth: 1, borderColor: '#ffffffd9' },
  colorChip: { width: 44, height: 44, borderRadius: 12, borderWidth: 2, borderColor: '#ffffff', elevation: 2 },
  previewCopy: { gap: 2 },
  previewTitle: { color: '#302b36', fontSize: 13, fontWeight: '700' },
  previewValue: { color: '#665f6f', fontSize: 12, letterSpacing: 1.2, fontWeight: '600' },
  label: { color: '#302b36', fontSize: 13, fontWeight: '700', marginTop: 2 },
  shadeField: { width: '100%', aspectRatio: 1.65, minHeight: 145, maxHeight: 220, overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: '#ffffff', backgroundColor: '#888' },
  shadeMarker: { position: 'absolute', width: 22, height: 22, marginLeft: -11, marginTop: -11, borderRadius: 11, borderWidth: 3, borderColor: '#fff', backgroundColor: 'transparent', elevation: 3 },
  hueTrack: { height: 28, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#ffffff', backgroundColor: '#888' },
  hueMarker: { position: 'absolute', top: -2, bottom: -2, width: 14, marginLeft: -7, borderRadius: 8, borderWidth: 2.5, borderColor: '#fff', backgroundColor: 'transparent', elevation: 3 },
  hint: { color: '#665f6f', fontSize: 12, lineHeight: 17 },
});
