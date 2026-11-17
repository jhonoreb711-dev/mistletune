import AsyncStorage from '@react-native-async-storage/async-storage';
import { chatWithNlp } from './nlpService';

const AI_PROVIDER_KEY = 'music-player.ai-provider';
const OLLAMA_HOST_KEY = 'music-player.ollama-host';
const OLLAMA_MODEL_KEY = 'music-player.ollama-model';
const GROQ_API_KEY_KEY = 'music-player.groq-api-key';
const GROQ_MODEL_KEY = 'music-player.groq-model';
const TTS_ENABLED_KEY = 'music-player.tts-enabled';
const TTS_VOICE_KEY = 'music-player.tts-voice';

export const DEFAULT_OLLAMA_HOST = 'http://192.168.1.242:11434';
export const DEFAULT_OLLAMA_MODEL = 'phi4-mini';
export const DEFAULT_GROQ_MODEL = 'llama-3.1-8b-instant';

export async function getAiSettings() {
  try {
    const pairs = await AsyncStorage.multiGet([
      AI_PROVIDER_KEY,
      OLLAMA_HOST_KEY,
      OLLAMA_MODEL_KEY,
      GROQ_API_KEY_KEY,
      GROQ_MODEL_KEY,
      TTS_ENABLED_KEY,
      TTS_VOICE_KEY,
    ]);
    const map = Object.fromEntries(pairs);
    return {
      provider: map[AI_PROVIDER_KEY] || 'nlp',
      ollamaHost: map[OLLAMA_HOST_KEY] || DEFAULT_OLLAMA_HOST,
      ollamaModel: map[OLLAMA_MODEL_KEY] || DEFAULT_OLLAMA_MODEL,
      groqApiKey: map[GROQ_API_KEY_KEY] || '',
      groqModel: map[GROQ_MODEL_KEY] || DEFAULT_GROQ_MODEL,
      ttsEnabled: map[TTS_ENABLED_KEY] === 'true',
      ttsVoice: map[TTS_VOICE_KEY] || 'female',
    };
  } catch {
    return {
      provider: 'nlp',
      ollamaHost: DEFAULT_OLLAMA_HOST,
      ollamaModel: DEFAULT_OLLAMA_MODEL,
      groqApiKey: '',
      groqModel: DEFAULT_GROQ_MODEL,
      ttsEnabled: false,
      ttsVoice: 'female',
    };
  }
}

export async function saveAiSettings(settings) {
  const updates = [];
  if (settings.provider !== undefined) updates.push([AI_PROVIDER_KEY, settings.provider]);
  if (settings.ollamaHost !== undefined) updates.push([OLLAMA_HOST_KEY, settings.ollamaHost]);
  if (settings.ollamaModel !== undefined) updates.push([OLLAMA_MODEL_KEY, settings.ollamaModel]);
  if (settings.groqApiKey !== undefined) updates.push([GROQ_API_KEY_KEY, settings.groqApiKey]);
  if (settings.groqModel !== undefined) updates.push([GROQ_MODEL_KEY, settings.groqModel]);
  if (settings.ttsEnabled !== undefined) updates.push([TTS_ENABLED_KEY, settings.ttsEnabled ? 'true' : 'false']);
  if (settings.ttsVoice !== undefined) updates.push([TTS_VOICE_KEY, settings.ttsVoice]);
  if (updates.length) {
    await AsyncStorage.multiSet(updates);
  }
}

// Backwards-compatible aliases
export async function getOllamaSettings() {
  const settings = await getAiSettings();
  return { host: settings.ollamaHost, model: settings.ollamaModel };
}

export async function saveOllamaSettings(host, model) {
  await saveAiSettings({ ollamaHost: host, ollamaModel: model });
}

function buildSystemPrompt(tracks) {
  if (tracks.length === 0) {
    return `You are MistleTunes DJ, a cheerful Christmas music assistant. The user has no songs imported yet. Kindly tell them to add songs in the Settings screen first, then come back to chat with you.`;
  }

  // Build a compact song list as context (max 200 songs)
  const songList = tracks.slice(0, 200).map((track, i) => {
    const artist = track.artist || 'Unknown Artist';
    const album = track.album || '';
    return album
      ? `${i + 1}. "${track.title}" by ${artist} (${album})`
      : `${i + 1}. "${track.title}" by ${artist}`;
  }).join('\n');

  return `You are MistleTunes DJ, a cheerful Christmas music assistant built into the user's personal music player app.

The user has ${tracks.length} songs in their local music library. Here is their song list:
${songList}

Your job:
1. Ask what mood or type of music they want, or respond to what they say.
2. Recommend specific songs FROM THE LIST ABOVE that match their mood/request.
3. Format song recommendations EXACTLY like this — use square brackets and the exact song title:
   [SONG: Song Title] by Artist Name

4. Only recommend songs that are in the list above. Never invent song titles.
5. Be warm, festive, and brief. Keep responses under 150 words.
6. If the user greets you, greet back and ask what they'd like to listen to.`;
}

/**
 * Streams a chat response from Groq Cloud API.
 */
export async function chatWithGroq(userMessage, tracks, history = [], onToken = null) {
  const { groqApiKey, groqModel } = await getAiSettings();

  if (!groqApiKey || !groqApiKey.trim()) {
    throw new Error(
      'Online mode requires a cloud key. Tap ⚙️ in the chat header to add your free key, or switch to Built-In mode.'
    );
  }

  const systemPrompt = buildSystemPrompt(tracks);
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((msg) => ({ role: msg.role, content: msg.content })),
    { role: 'user', content: userMessage },
  ];

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groqApiKey.trim()}`,
    },
    body: JSON.stringify({
      model: groqModel || DEFAULT_GROQ_MODEL,
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 350,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Groq error (${response.status}): ${errorText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || !line.startsWith('data:')) continue;
      const dataStr = line.replace(/^data:\s*/, '').trim();
      if (dataStr === '[DONE]') break;

      try {
        const parsed = JSON.parse(dataStr);
        const delta = parsed?.choices?.[0]?.delta?.content || '';
        if (delta) {
          fullText += delta;
          onToken?.(fullText);
        }
      } catch {}
    }
  }

  return fullText;
}

/**
 * Streams a chat response from local Ollama.
 */
export async function chatWithOllama(userMessage, tracks, history = [], onToken = null) {
  const { ollamaHost, ollamaModel } = await getAiSettings();

  const systemPrompt = buildSystemPrompt(tracks);
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((msg) => ({ role: msg.role, content: msg.content })),
    { role: 'user', content: userMessage },
  ];

  const url = `${ollamaHost}/api/chat`;
  const body = JSON.stringify({
    model: ollamaModel,
    messages,
    stream: true,
    options: {
      temperature: 0.7,
      num_predict: 300,
    },
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Ollama error (${response.status}): ${errorText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n').filter((line) => line.trim());

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        const token = parsed?.message?.content || '';
        if (token) {
          fullText += token;
          onToken?.(fullText);
        }
        if (parsed?.done) break;
      } catch {}
    }
  }

  return fullText;
}

/**
 * Tests whether the given provider configuration can be reached and authenticated.
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function testConnection(provider, config = {}) {
  if (provider === 'nlp') {
    return {
      success: true,
      message: 'Built-In mode is active and ready on your device.',
    };
  }

  if (provider === 'groq') {
    const key = (config.groqApiKey || '').trim();
    if (!key) {
      return {
        success: false,
        message: 'Please enter a Cloud Access Key first.',
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch('https://api.groq.com/openai/v1/models', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        return {
          success: true,
          message: 'Connected to Online service successfully!',
        };
      }

      if (response.status === 401) {
        return {
          success: false,
          message: 'Invalid key. Please check your cloud access key from groq.com.',
        };
      }

      const errText = await response.text().catch(() => '');
      return {
        success: false,
        message: `Online service error (${response.status}): ${errText.slice(0, 80)}`,
      };
    } catch (err) {
      if (err.name === 'AbortError') {
        return {
          success: false,
          message: 'Connection timed out. Check your internet connection.',
        };
      }
      return {
        success: false,
        message: 'Could not reach the online service. Check your internet connection.',
      };
    }
  }

  if (provider === 'ollama') {
    let host = (config.ollamaHost || '').trim();
    if (!host) {
      return {
        success: false,
        message: 'Please enter your computer Wi-Fi address.',
      };
    }

    if (!/^https?:\/\//i.test(host)) {
      host = `http://${host}`;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${host}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json().catch(() => null);
        const models = Array.isArray(data?.models) ? data.models.map((m) => m.name) : [];
        const targetModel = config.ollamaModel ? config.ollamaModel.trim() : '';

        if (targetModel && models.length > 0 && !models.some((m) => m.includes(targetModel))) {
          return {
            success: true,
            message: `Connected to computer! (Found: ${models.slice(0, 2).join(', ')} — check model name if needed)`,
          };
        }

        return {
          success: true,
          message: `Connected to your computer successfully! (${models.length || 1} model${models.length === 1 ? '' : 's'} available)`,
        };
      }

      return {
        success: false,
        message: `Computer responded with error (${response.status}).`,
      };
    } catch (err) {
      if (err.name === 'AbortError') {
        return {
          success: false,
          message: `Connection timed out connecting to ${host}. Ensure your computer is on and on the same Wi-Fi.`,
        };
      }
      return {
        success: false,
        message: `Cannot reach computer at ${host}. Make sure Ollama is running and phone is on the same Wi-Fi.`,
      };
    }
  }

  return { success: false, message: 'Unknown mode.' };
}

/**
 * Main chat dispatcher — routes to On-Device NLP, Groq Cloud, or Local Ollama.
 */
export async function chatWithAi(userMessage, tracks, history = [], onToken = null) {
  const { provider } = await getAiSettings();

  if (provider === 'nlp') {
    return chatWithNlp(userMessage, tracks, onToken);
  }

  if (provider === 'ollama') {
    return chatWithOllama(userMessage, tracks, history, onToken);
  }

  // Default: Groq Cloud
  return chatWithGroq(userMessage, tracks, history, onToken);
}

/**
 * Parse the AI response and extract [SONG: ...] recommendations
 */
export function parseSongRecommendations(text, tracks) {
  const pattern = /\[(SONG|PODCAST):\s*([^\]]+)\]/gi;
  const recommendations = [];
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const title = match[2].trim();
    const normalizedTitle = title.toLowerCase();
    const candidates = tracks.filter((track) => match[1].toUpperCase() === 'PODCAST'
      ? track.mediaType === 'podcast' : track.mediaType !== 'podcast');
    const found = candidates.find((track) => (track.title || '').toLowerCase() === normalizedTitle);
    recommendations.push({ title, track: found || null });
  }

  return recommendations;
}

/**
 * Returns the display text with [SONG:...] tags replaced by placeholders for rendering
 */
export function formatMessageText(text) {
  return text.replace(/\[(?:SONG|PODCAST):\s*([^\]]+)\]/gi, '🎵 $1');
}

/**
 * Transcribes a recorded audio file to text using Groq Whisper API.
 * Requires a valid Groq API key saved in settings.
 * @param {string} audioUri - Local file URI of the recorded audio (m4a/mp4)
 * @param {string} groqApiKey - Groq API key
 * @returns {Promise<string>} Transcribed text
 */
export async function transcribeAudio(audioUri, groqApiKey) {
  if (!groqApiKey || !groqApiKey.trim()) {
    throw new Error('Voice input requires a Cloud Access Key.\n\nAdd your free key in ⚙️ MistleTunes Chatbot Settings → Online mode → Cloud Access Key.\n\nYou can still type your message manually.');
  }

  const formData = new FormData();
  formData.append('file', {
    uri: audioUri,
    type: 'audio/m4a',
    name: 'voice_input.m4a',
  });
  formData.append('model', 'whisper-large-v3-turbo');
  formData.append('response_format', 'text');
  formData.append('language', 'en');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqApiKey.trim()}`,
      },
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      if (response.status === 401) {
        throw new Error('Invalid Cloud Access Key. Please check your key in settings.');
      }
      throw new Error(`Voice transcription failed (${response.status}): ${errText.slice(0, 80)}`);
    }

    const text = await response.text();
    return text.trim();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Voice transcription timed out. Please try again.');
    }
    throw err;
  }
}
