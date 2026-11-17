export const MAX_LYRIC_AUDIO_SECONDS = 8 * 60;
export const TRANSCRIPTION_SAMPLE_RATE = 16000;

export function localAudioUri(source) {
  const uri = typeof source === 'string' ? source : source?.uri;
  if (typeof uri !== 'string' || !uri.startsWith('file://')) {
    throw new Error('Lyrics generation needs an imported local music file.');
  }
  return uri;
}

export function monoChunk(buffer, start, count) {
  if (buffer.sampleRate !== TRANSCRIPTION_SAMPLE_RATE || buffer.numberOfChannels < 1 || buffer.numberOfChannels > 2) {
    throw new Error('This audio format cannot be transcribed on this device.');
  }
  const length = Math.min(count, buffer.length - start);
  const output = new Float32Array(length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = buffer.getChannelData(channel);
    for (let index = 0; index < length; index++) output[index] += (samples[start + index] || 0) / buffer.numberOfChannels;
  }
  return output;
}

export function segmentsToLrc(segments) {
  return segments.filter((segment) => Number.isFinite(segment.time) && segment.time >= 0 && segment.text?.trim())
    .sort((a, b) => a.time - b.time)
    .map(({ time, text }) => {
      const centiseconds = Math.round(time * 100);
      const minutes = Math.floor(centiseconds / 6000);
      const seconds = Math.floor(centiseconds / 100) % 60;
      const fraction = centiseconds % 100;
      return `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(fraction).padStart(2, '0')}]${text.replace(/\s+/g, ' ').trim()}`;
    }).join('\n');
}
