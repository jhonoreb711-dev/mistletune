import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import soundWave from '../assets/sound_wave.gif';
import { useReducedMotion } from 'react-native-reanimated';

const RATE = 60;
// Retain only compact envelopes, never decoded songs, between visits.
const envelopes = new Map();
let decoding = Promise.resolve();

async function loadEnvelope(source, cancelled) {
  if (envelopes.has(source)) return envelopes.get(source);
  const task = decoding.catch(() => {}).then(async () => {
    if (cancelled()) return null;
    if (envelopes.has(source)) return envelopes.get(source);
    const { decodeAudioData, getAudioDuration } = await import('react-native-audio-api');
    // Bound decoding memory for long recordings; music playback is unaffected.
    const duration = await getAudioDuration(source);
    if (!Number.isFinite(duration) || duration <= 0 || duration > 600 || cancelled()) return null;
    const buffer = await decodeAudioData(source, 4000);
    if (cancelled()) return null;
    const samples = buffer.getChannelData(0);
    const step = Math.max(1, Math.round(buffer.sampleRate / RATE));
    const levels = new Float32Array(Math.ceil(samples.length / step));
    for (let i = 0; i < levels.length; i++) {
      let sum = 0;
      const end = Math.min(samples.length, (i + 1) * step);
      for (let j = i * step; j < end; j++) sum += samples[j] * samples[j];
      levels[i] = Math.min(1, Math.sqrt(sum / (end - i * step)) * 3);
    }
    if (envelopes.size >= 4) envelopes.delete(envelopes.keys().next().value);
    const envelope = { levels, rate: buffer.sampleRate / step };
    envelopes.set(source, envelope);
    return envelope;
  });
  decoding = task;
  return task;
}

export default function PlayerSoundWave({ track, player, active, color }) {
  const [envelope, setEnvelope] = useState(null);
  const [loudness, setLoudness] = useState(0);
  const imageRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const source = track?.uri || track?.source?.uri || track?.source;

  useEffect(() => {
    let cancelled = false;
    if (source) loadEnvelope(source, () => cancelled).then(value => {
      if (!cancelled) setEnvelope(value);
    }).catch(() => { /* Use the decorative playback animation when decoding is unavailable. */ });
    return () => { cancelled = true; };
  }, [source]);

  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;
    const operation = active && !reducedMotion ? image.startAnimating() : image.stopAnimating();
    operation?.catch(() => {});
  }, [active, reducedMotion]);

  useEffect(() => {
    if (!active || reducedMotion || !envelope) return;
    const timer = setInterval(() => {
      try {
        const index = Math.floor(player.currentTime * envelope.rate);
        // Smooth a short audio window to avoid flicker; preserve actual quiet passages.
        let level = 0;
        for (let i = 0; i < 4; i++) level = Math.max(level, envelope.levels[index - i] || 0);
        const gain = player.muted ? 0 : Math.max(0, Math.min(1, player.volume ?? 1));
        setLoudness(previous => previous * 0.25 + level * gain * 0.75);
      } catch { /* Player disposed. */ }
    }, 50);
    return () => clearInterval(timer);
  }, [active, envelope, player, reducedMotion]);

  const motionActive = active && !reducedMotion;
  const intensity = motionActive ? (envelope ? loudness : 0.55) : 0;
  const syncAnimation = () => {
    const image = imageRef.current;
    if (!image) return;
    const operation = motionActive ? image.startAnimating() : image.stopAnimating();
    operation?.catch(() => {});
  };

  return (
    <View style={styles.wave} accessible accessibilityLabel={envelope ? 'Sound wave responding to song loudness' : 'Animated sound wave'} pointerEvents="none">
      <View style={[styles.glow, { backgroundColor: color }]} />
      <Image ref={imageRef} source={soundWave} contentFit="fill" autoplay={motionActive}
        tintColor={color} onLoad={syncAnimation}
        style={[styles.image, { opacity: 1, transform: [{ scaleY: 0.85 + intensity * 0.15 }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wave: { height: 100, width: '100%', flexShrink: 0, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: 100, backgroundColor: 'transparent' },
  glow: { position: 'absolute', width: '96%', height: 56, borderRadius: 28, opacity: 0.1 },
});
