import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ImageBackground } from 'expo-image';
import { usePlayback } from './PlaybackContext';
import {
  chatWithAi,
  testConnection,
  parseSongRecommendations,
  formatMessageText,
  getAiSettings,
  saveAiSettings,
  DEFAULT_OLLAMA_HOST,
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_GROQ_MODEL,
} from './ollamaService';
import {
  createSession,
  getAllSessions,
  getSessionMessages,
  addMessageToSession,
  updateSessionTitle,
  deleteSession,
  clearAllSessions,
} from './chatDatabase';

import chatBg from '../assets/christmas_bg3.png';

const COLORS = {
  green: '#0f3d28',
  darkGreen: '#072016',
  red: '#8e1420',
  gold: '#f2bb4f',
  cream: '#fff8e9',
  ink: '#1e1a14',
  muted: '#7a6e5c',
  bubble: 'rgba(255,248,233,0.95)',
  aiHue: 'rgba(10,55,32,0.92)',
};

function formatSessionDate(timestamp) {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function TypingDots() {
  const [dot1] = useState(() => new Animated.Value(0));
  const [dot2] = useState(() => new Animated.Value(0));
  const [dot3] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const anim = (val, delay) => Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(val, { toValue: -6, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(val, { toValue: 0, duration: 280, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.delay(600),
      ])
    );
    const a1 = anim(dot1, 0);
    const a2 = anim(dot2, 150);
    const a3 = anim(dot3, 300);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [dot1, dot2, dot3]);

  return (
    <View style={typingStyles.row}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View key={i} style={[typingStyles.dot, { transform: [{ translateY: dot }] }]} />
      ))}
    </View>
  );
}

const typingStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 4, paddingVertical: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.gold },
});

function SongChip({ title, track, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Search and play ${title}`}
      onPress={() => onPress(title, track)}
      style={({ pressed }) => [styles.songChip, pressed && styles.songChipPressed, !track && styles.songChipDisabled]}
    >
      <Ionicons name="musical-note" size={12} color={track ? COLORS.gold : COLORS.muted} />
      <Text numberOfLines={1} style={[styles.songChipText, !track && styles.songChipTextDisabled]}>
        {title}
      </Text>
      {track ? <Ionicons name="play-circle" size={14} color={COLORS.gold} /> : null}
    </Pressable>
  );
}

function ChatMessage({ message, tracks, onSongPress, onSpeak, isSpeakingMessage }) {
  const isUser = message.role === 'user';
  const isAI = message.role === 'assistant';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <View style={styles.systemMsg}>
        <Text style={styles.systemMsgText}>{message.content}</Text>
      </View>
    );
  }

  // If assistant message is awaiting its first token, show typing dots directly in its bubble
  if (isAI && !message.content) {
    return (
      <View style={styles.msgRow}>
        <View style={styles.aiAvatar}>
          <Ionicons name="musical-notes" size={16} color={COLORS.gold} />
        </View>
        <View style={[styles.bubble, styles.bubbleAI, styles.typingBubble]}>
          <TypingDots />
        </View>
      </View>
    );
  }

  const recommendations = isAI ? parseSongRecommendations(message.content, tracks) : [];
  const displayText = isAI ? formatMessageText(message.content) : message.content;

  return (
    <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
      {isAI && (
        <View style={styles.aiAvatar}>
          <Ionicons name="musical-notes" size={16} color={COLORS.gold} />
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
          {displayText}
        </Text>
        {recommendations.length > 0 && (
          <View style={styles.songChips}>
            {recommendations.map((rec, i) => (
              <SongChip
                key={i}
                title={rec.title}
                track={rec.track}
                onPress={onSongPress}
              />
            ))}
          </View>
        )}
        {isAI && !!displayText && (
          <View style={styles.aiBubbleActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isSpeakingMessage ? 'Stop reading' : 'Read response aloud'}
              onPress={() => onSpeak?.(message.content, message.id || displayText)}
              style={({ pressed }) => [
                styles.msgSpeakBtn,
                isSpeakingMessage && styles.msgSpeakBtnActive,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons
                name={isSpeakingMessage ? 'volume-high' : 'volume-medium-outline'}
                size={14}
                color={isSpeakingMessage ? COLORS.gold : 'rgba(255,248,233,0.85)'}
              />
              <Text style={[styles.msgSpeakBtnText, isSpeakingMessage && styles.msgSpeakBtnTextActive]}>
                {isSpeakingMessage ? 'Stop' : 'Listen'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

function getSpeechModule() {
  try {
    const { requireOptionalNativeModule } = require('expo-modules-core');
    if (requireOptionalNativeModule('ExpoSpeech')) {
      return require('expo-speech');
    }
  } catch {}
  return null;
}

function getSpeechRecognitionModule() {
  try {
    const { requireOptionalNativeModule } = require('expo-modules-core');
    if (requireOptionalNativeModule('ExpoSpeechRecognition')) {
      return require('expo-speech-recognition').ExpoSpeechRecognitionModule;
    }
  } catch {}
  return null;
}

export default function ChatBot() {
  const [visible, setVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [sessionsList, setSessionsList] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameTargetSession, setRenameTargetSession] = useState(null);
  const [renameText, setRenameText] = useState('');
  const [aiProvider, setAiProvider] = useState('nlp');
  const [ollamaHost, setOllamaHost] = useState(DEFAULT_OLLAMA_HOST);
  const [ollamaModel, setOllamaModel] = useState(DEFAULT_OLLAMA_MODEL);
  const [groqApiKey, setGroqApiKey] = useState('');
  const [groqModel, setGroqModel] = useState(DEFAULT_GROQ_MODEL);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);
  // TTS state
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [ttsVoice, setTtsVoice] = useState('female');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState(null);
  // Speech recognition state
  const [isListening, setIsListening] = useState(false);
  const speechSubsRef = useRef([]);
  const voiceSessionRef = useRef(null);
  const [voiceMessage, setVoiceMessage] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const insets = useSafeAreaInsets();
  const { tracks, setSpeechActive } = usePlayback();

  const [pulse] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  useEffect(() => {
    getAiSettings().then((cfg) => {
      setAiProvider(cfg.provider);
      setOllamaHost(cfg.ollamaHost);
      setOllamaModel(cfg.ollamaModel);
      setGroqApiKey(cfg.groqApiKey);
      setGroqModel(cfg.groqModel);
      setTtsEnabled(cfg.ttsEnabled);
      setTtsVoice(cfg.ttsVoice || 'female');
    });
  }, []);

  const getGreetingText = useCallback(() => (
    tracks.length > 0
      ? `🎄 Ho ho ho! I'm your MistleTunes DJ! I can see you have ${tracks.length} song${tracks.length === 1 ? '' : 's'} in your library.\n\nWhat's your mood? Tell me how you feel or what kind of music you want, and I'll pick the perfect songs for you! 🎵`
      : `🎄 Ho ho ho! I'm your MistleTunes DJ!\n\nIt looks like your music library is empty. Go to Settings and add your music folder first, then come back and I'll recommend songs for your mood! 🎵`
  ), [tracks.length]);

  // Load or initialize SQLite chat session
  const initChatSession = useCallback(async () => {
    try {
      const all = await getAllSessions();
      setSessionsList(all);

      if (all.length > 0) {
        // Pick the most recent session
        const active = all[0];
        setCurrentSession(active);
        const msgs = await getSessionMessages(active.id);
        if (msgs.length > 0) {
          setMessages(msgs);
        } else {
          // If session is empty, insert the greeting
          const greetingContent = getGreetingText();
          await addMessageToSession(active.id, 'assistant', greetingContent);
          setMessages([{ role: 'assistant', content: greetingContent }]);
        }
      } else {
        // Create initial session
        const newSess = await createSession('New Conversation');
        setCurrentSession(newSess);
        setSessionsList([newSess]);
        const greetingContent = getGreetingText();
        await addMessageToSession(newSess.id, 'assistant', greetingContent);
        setMessages([{ role: 'assistant', content: greetingContent }]);
      }
    } catch (err) {
      console.warn('Error initializing SQLite chat:', err);
    }
  }, [getGreetingText]);

  const openChat = useCallback(() => {
    setVisible(true);
    initChatSession();
  }, [initChatSession]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  // — TTS: strip markdown/emoji, speak the reply —
  const speakReply = useCallback((text, messageId = null) => {
    if (!text) return;
    const clean = text
      .replace(/\[SONG:[^\]]+\]/gi, '')
      .replace(/🎵[^\n]*/g, '')
      .replace(/[*_~`#>]+/g, '')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, ' ')
      .trim();
    if (!clean) return;

    const Speech = getSpeechModule();
    if (!Speech) {
      Alert.alert(
        'Voice Speech',
        'Offline text-to-speech will read aloud automatically in your production build.'
      );
      return;
    }

    try {
      Speech.stop();
      setIsSpeaking(true);
      setSpeakingMessageId(messageId);
      setSpeechActive?.(true);

      Speech.speak(clean, {
        language: 'en-US',
        pitch: ttsVoice === 'male' ? 0.75 : 1.15,
        rate: ttsVoice === 'male' ? 0.88 : 0.96,
        onDone: () => {
          setIsSpeaking(false);
          setSpeakingMessageId(null);
          setSpeechActive?.(false);
        },
        onError: () => {
          setIsSpeaking(false);
          setSpeakingMessageId(null);
          setSpeechActive?.(false);
        },
        onStopped: () => {
          setIsSpeaking(false);
          setSpeakingMessageId(null);
          setSpeechActive?.(false);
        },
      });
    } catch (err) {
      console.warn('TTS speak error:', err);
      setIsSpeaking(false);
      setSpeakingMessageId(null);
      setSpeechActive?.(false);
    }
  }, [ttsVoice, setSpeechActive]);

  const stopSpeaking = useCallback(() => {
    const Speech = getSpeechModule();
    if (Speech) {
      try {
        Speech.stop();
      } catch {}
    }
    setIsSpeaking(false);
    setSpeakingMessageId(null);
    setSpeechActive?.(false);
  }, [setSpeechActive]);

  const handleToggleSpeak = useCallback((text, id) => {
    if (isSpeaking && speakingMessageId === id) {
      stopSpeaking();
    } else {
      speakReply(text, id);
    }
  }, [isSpeaking, speakingMessageId, stopSpeaking, speakReply]);

  // Preview voice sample in settings
  const testVoiceSample = useCallback((voiceGender = ttsVoice) => {
    const Speech = getSpeechModule();
    if (!Speech) {
      Alert.alert('Voice Preview', 'Speech synthesis is active in your production build.');
      return;
    }
    const sample = voiceGender === 'male'
      ? "Ho ho ho! I'm your MistleTunes DJ. What festive songs would you like to hear?"
      : "Ho ho ho! I'm your MistleTunes DJ. Tell me your mood, and I'll play the perfect music!";

    try {
      Speech.stop();
      setIsSpeaking(true);
      setSpeakingMessageId('preview');
      setSpeechActive?.(true);
      Speech.speak(sample, {
        language: 'en-US',
        pitch: voiceGender === 'male' ? 0.75 : 1.15,
        rate: voiceGender === 'male' ? 0.88 : 0.96,
        onDone: () => {
          setIsSpeaking(false);
          setSpeakingMessageId(null);
          setSpeechActive?.(false);
        },
        onError: () => {
          setIsSpeaking(false);
          setSpeakingMessageId(null);
          setSpeechActive?.(false);
        },
        onStopped: () => {
          setIsSpeaking(false);
          setSpeakingMessageId(null);
          setSpeechActive?.(false);
        },
      });
    } catch (err) {
      console.warn('Voice preview error:', err);
      setIsSpeaking(false);
      setSpeakingMessageId(null);
      setSpeechActive?.(false);
    }
  }, [ttsVoice, setSpeechActive]);

  // Voice input: cancel on navigation, finalize on manual stop.
  const stopListening = useCallback(() => {
    voiceSessionRef.current = null;
    setVoiceMessage(null);
    setIsListening(false);
    setSpeechActive?.(false);
    const mod = getSpeechRecognitionModule();
    if (mod) {
      try {
        mod.abort();
      } catch {}
    }
    speechSubsRef.current.forEach((sub) => {
      try {
        sub?.remove?.();
      } catch {}
    });
    speechSubsRef.current = [];
  }, [setSpeechActive]);

  const startListening = useCallback(async () => {
    if (voiceSessionRef.current || isTyping || !currentSession) return;
    stopSpeaking();
    const mod = getSpeechRecognitionModule();

    if (!mod) {
      inputRef.current?.focus();
      Alert.alert(
        'Voice Input',
        'Voice input requires a development or production build with speech recognition included. It is unavailable in Expo Go.',
        [{ text: 'Got it!' }]
      );
      return;
    }

    const session = { finalText: '', failed: false };
    voiceSessionRef.current = session;
    setIsListening(true);
    try {
      const perm = await mod.requestPermissionsAsync();
      if (voiceSessionRef.current !== session) return;
      if (!perm.granted) {
        stopListening();
        Alert.alert('Microphone Access', 'Allow microphone and speech recognition access in your phone settings to use voice input.');
        return;
      }
      if (!mod.isRecognitionAvailable()) {
        stopListening();
        Alert.alert('Voice Input', 'Speech recognition is unavailable. On Android, install or enable the Google app and Speech Services by Google.');
        return;
      }

      speechSubsRef.current.forEach((sub) => {
        try {
          sub?.remove?.();
        } catch {}
      });
      speechSubsRef.current = [];

      const subResult = mod.addListener('result', (event) => {
        if (voiceSessionRef.current !== session) return;
        if (event?.results?.length > 0) {
          const transcript = event.results[0]?.transcript || '';
          if (transcript) {
            setInput(transcript);
            if (event.isFinal) session.finalText = transcript.trim();
          }
        }
      });

      const subEnd = mod.addListener('end', () => {
        if (voiceSessionRef.current !== session) return;
        voiceSessionRef.current = null;
        setIsListening(false);
        setSpeechActive?.(false);
        speechSubsRef.current.forEach((sub) => sub?.remove?.());
        speechSubsRef.current = [];
        if (!session.failed && session.finalText) setVoiceMessage(session.finalText);
      });

      const subError = mod.addListener('error', (err) => {
        if (voiceSessionRef.current !== session) return;
        session.failed = true;
        console.warn('Speech recognition error:', err);
        if (err.error !== 'aborted') Alert.alert('Voice Input', 'Speech recognition failed. Check microphone permissions and your internet connection, then try again.');
      });

      speechSubsRef.current = [subResult, subEnd, subError];

      const services = Platform.OS === 'android' ? mod.getSpeechRecognitionServices() : [];
      const googleService = ['com.google.android.googlequicksearchbox', 'com.google.android.tts']
        .find((service) => services.includes(service));
      setSpeechActive?.(true);
      mod.start({
          lang: 'en-US',
          interimResults: true,
          continuous: false,
          requiresOnDeviceRecognition: false,
          ...(googleService ? { androidRecognitionServicePackage: googleService } : {}),
        });
    } catch (err) {
      if (voiceSessionRef.current !== session) return;
      stopListening();
      console.warn('Error starting speech recognition:', err);
      Alert.alert('Voice Input', 'Could not start voice recognition: ' + (err.message || 'Unknown error'));
      setIsListening(false);
      setSpeechActive?.(false);
    }
  }, [stopSpeaking, stopListening, setSpeechActive, isTyping, currentSession]);

  const finishListening = useCallback(() => {
    try { getSpeechRecognitionModule()?.stop(); } catch { stopListening(); }
  }, [stopListening]);

  useEffect(() => {
    return () => {
      voiceSessionRef.current = null;
      speechSubsRef.current.forEach((sub) => {
        try {
          sub?.remove?.();
        } catch {}
      });
      speechSubsRef.current = [];
      const mod = getSpeechRecognitionModule();
      if (mod) {
        try {
          mod.abort();
        } catch {}
      }
      const Speech = getSpeechModule();
      if (Speech) {
        try {
          Speech.stop();
        } catch {}
      }
      setSpeechActive?.(false);
    };
  }, [setSpeechActive]);

  useEffect(() => {
    if (visible) scrollToBottom();
  }, [messages, visible, scrollToBottom]);

  // Create a brand new conversation
  const handleNewConversation = useCallback(async () => {
    stopListening();
    try {
      const newSess = await createSession('New Conversation');
      setCurrentSession(newSess);
      const greetingContent = getGreetingText();
      await addMessageToSession(newSess.id, 'assistant', greetingContent);
      setMessages([{ role: 'assistant', content: greetingContent }]);

      const all = await getAllSessions();
      setSessionsList(all);
      setDrawerVisible(false);
    } catch (err) {
      console.warn('Error creating new conversation:', err);
    }
  }, [getGreetingText, stopListening]);

  // Switch to an existing conversation
  const handleSelectSession = useCallback(async (session) => {
    stopListening();
    try {
      setCurrentSession(session);
      const msgs = await getSessionMessages(session.id);
      setMessages(msgs);
      setDrawerVisible(false);
    } catch (err) {
      console.warn('Error loading session messages:', err);
    }
  }, [stopListening]);

  // Rename a conversation
  const promptRenameSession = useCallback((session) => {
    setRenameTargetSession(session);
    setRenameText(session.title || '');
    setRenameModalVisible(true);
  }, []);

  const confirmRenameSession = useCallback(async () => {
    if (!renameTargetSession || !renameText.trim()) return;
    try {
      await updateSessionTitle(renameTargetSession.id, renameText.trim());
      const all = await getAllSessions();
      setSessionsList(all);
      if (currentSession?.id === renameTargetSession.id) {
        setCurrentSession({ ...currentSession, title: renameText.trim() });
      }
    } catch (err) {
      console.warn('Error renaming session:', err);
    } finally {
      setRenameModalVisible(false);
      setRenameTargetSession(null);
    }
  }, [renameTargetSession, renameText, currentSession]);

  // Delete a conversation
  const handleDeleteSession = useCallback((session) => {
    Alert.alert(
      'Delete Conversation',
      `Are you sure you want to delete "${session.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSession(session.id);
              const all = await getAllSessions();
              setSessionsList(all);

              if (currentSession?.id === session.id) {
                if (all.length > 0) {
                  const nextSess = all[0];
                  setCurrentSession(nextSess);
                  const msgs = await getSessionMessages(nextSess.id);
                  setMessages(msgs);
                } else {
                  await handleNewConversation();
                }
              }
            } catch (err) {
              console.warn('Error deleting session:', err);
            }
          },
        },
      ]
    );
  }, [currentSession, handleNewConversation]);

  // Clear all conversations
  const handleClearAllSessions = useCallback(() => {
    Alert.alert(
      'Clear All Conversations',
      'Are you sure you want to delete all chat history? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllSessions();
              await handleNewConversation();
            } catch (err) {
              console.warn('Error clearing sessions:', err);
            }
          },
        },
      ]
    );
  }, [handleNewConversation]);

  // Send message and stream Ollama response
  const sendMessage = useCallback(async (voiceText) => {
    const text = (typeof voiceText === 'string' ? voiceText : input).trim();
    if (!text || isTyping || !currentSession) return;

    // Stop any ongoing speech or voice listening when user sends a new message
    stopSpeaking();
    if (isListening) stopListening();
    setInput('');
    const userMsg = { role: 'user', content: text };

    // Optimistically update UI
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    // Persist user message
    try {
      await addMessageToSession(currentSession.id, 'user', text);
      const all = await getAllSessions();
      setSessionsList(all);
      const updated = all.find((s) => s.id === currentSession.id);
      if (updated) setCurrentSession(updated);
    } catch (dbErr) {
      console.warn('Error saving user message to SQLite:', dbErr);
    }

    // Build context history from current messages
    const historyForOllama = messages.filter((m) => m.role !== 'system');

    // Add streaming assistant placeholder
    const aiPlaceholder = { role: 'assistant', content: '' };
    setMessages((prev) => [...prev, aiPlaceholder]);

    let fullReply = '';
    try {
      fullReply = await chatWithAi(text, tracks, historyForOllama, (streamedText) => {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: streamedText };
          return updated;
        });
        scrollToBottom();
      });

      // Persist assistant message
      await addMessageToSession(currentSession.id, 'assistant', fullReply);

      // Speak the reply if TTS is enabled
      if (ttsEnabled) {
        speakReply(fullReply, currentSession.id + '-' + Date.now());
      }
    } catch (err) {
      let errMsg = '';
      if (aiProvider === 'groq') {
        if (!groqApiKey || !groqApiKey.trim()) {
          errMsg = '⚠️ Online mode needs a cloud access key.\n\nTap ⚙️ in the top right to add your free key, or switch to Built-In mode for instant offline recommendations.';
        } else {
          errMsg = `❌ Online assistant error: ${err.message}`;
        }
      } else {
        errMsg = err.message?.includes('fetch') || err.message?.includes('Network')
          ? `❌ Cannot reach your computer at ${ollamaHost}.\n\nMake sure:\n• Your computer is turned on\n• Your phone and computer are on the same Wi-Fi\n• Or switch to Built-In mode in settings (⚙️)`
          : `❌ Computer connection error: ${err.message}`;
      }

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: errMsg };
        return updated;
      });

      try {
        await addMessageToSession(currentSession.id, 'assistant', errMsg);
      } catch {}
    } finally {
      setIsTyping(false);
      scrollToBottom();
    }
  }, [input, isTyping, currentSession, messages, tracks, aiProvider, groqApiKey, ollamaHost, scrollToBottom, stopSpeaking, isListening, stopListening, ttsEnabled, speakReply]);

  useEffect(() => {
    if (!voiceMessage) return;
    const timer = setTimeout(() => {
      setVoiceMessage(null);
      if (visible && !isTyping && currentSession) void sendMessage(voiceMessage);
    }, 0);
    return () => clearTimeout(timer);
  }, [voiceMessage, visible, isTyping, currentSession, sendMessage]);

  // Click on a song card: redirects to Search page with song query and auto-plays
  const handleSongPress = useCallback((title, track) => {
    stopSpeaking();
    stopListening();
    setSpeechActive?.(false);
    const songQuery = track?.title || title;
    setVisible(false);
    router.push({
      pathname: '/Search',
      params: {
        query: songQuery,
        category: 'Songs',
        autoPlay: track ? '1' : '0',
        requestId: Date.now().toString(),
      },
    });
  }, [stopSpeaking, stopListening, setSpeechActive]);

  const closeChat = useCallback(() => {
    stopSpeaking();
    stopListening();
    setSpeechActive?.(false);
    setVisible(false);
  }, [stopSpeaking, stopListening, setSpeechActive]);

  const handleTestConnection = useCallback(async (targetProvider = aiProvider) => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await testConnection(targetProvider, {
        groqApiKey,
        groqModel,
        ollamaHost,
        ollamaModel,
      });
      setTestResult(res);
      return res;
    } catch (e) {
      const res = { success: false, message: e.message || 'Connection test failed.' };
      setTestResult(res);
      return res;
    } finally {
      setTestingConnection(false);
    }
  }, [aiProvider, groqApiKey, groqModel, ollamaHost, ollamaModel]);

  const saveSettings = useCallback(async () => {
    if (aiProvider !== 'nlp') {
      const test = await handleTestConnection(aiProvider);
      if (!test.success) {
        Alert.alert(
          'Connection Test Warning',
          `${test.message}\n\nDo you still want to save these settings anyway?`,
          [
            { text: 'Keep Editing', style: 'cancel' },
            {
              text: 'Save Anyway',
              onPress: async () => {
                await saveAiSettings({
                  provider: aiProvider,
                  ollamaHost: ollamaHost.trim(),
                  ollamaModel: ollamaModel.trim(),
                  groqApiKey: groqApiKey.trim(),
                  groqModel: groqModel.trim(),
                  ttsEnabled,
                  ttsVoice,
                });
                setSettingsVisible(false);
              },
            },
          ]
        );
        return;
      }
    }

    await saveAiSettings({
      provider: aiProvider,
      ollamaHost: ollamaHost.trim(),
      ollamaModel: ollamaModel.trim(),
      groqApiKey: groqApiKey.trim(),
      groqModel: groqModel.trim(),
      ttsEnabled,
      ttsVoice,
    });
    setSettingsVisible(false);
  }, [aiProvider, handleTestConnection, ollamaHost, ollamaModel, groqApiKey, groqModel, ttsEnabled, ttsVoice]);

  return (
    <>
      {/* Floating Chat Button */}
      <Animated.View
        style={[
          styles.fab,
          {
            bottom: Math.max(insets.bottom, 12) + 175,
            transform: [{ scale: pulse }],
          },
        ]}
        pointerEvents="box-none"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open music DJ chatbot"
          onPress={() => openChat()}
          style={({ pressed }) => [styles.fabInner, pressed && styles.fabPressed]}
        >
          <Ionicons name="chatbubble-ellipses" size={26} color={COLORS.cream} />
          <View style={styles.fabBadge}>
            <Ionicons name="musical-note" size={9} color={COLORS.gold} />
          </View>
        </Pressable>
      </Animated.View>

      {/* Main Chat Modal */}
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={closeChat}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ImageBackground source={chatBg} contentFit="cover" style={styles.chatScreen}>
            {/* Header with ChatGPT/Claude style conversation navigation */}
            <View style={[styles.chatHeader, { paddingTop: insets.top + 10 }]}>
              {/* Menu button to open Conversations list */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open conversations list"
                onPress={() => setDrawerVisible(true)}
                style={styles.chatHeaderBtn}
              >
                <Ionicons name="menu-outline" size={22} color={COLORS.gold} />
              </Pressable>

              {/* Current Session Title */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View conversations"
                onPress={() => setDrawerVisible(true)}
                style={styles.chatHeaderInfo}
              >
                <View style={styles.chatHeaderTitleRow}>
                  <Text numberOfLines={1} style={styles.chatHeaderTitle}>
                    {currentSession?.title || 'MistleTunes DJ 🎄'}
                  </Text>
                  <Ionicons name="chevron-down" size={13} color={COLORS.gold} />
                </View>
                <Text style={styles.chatHeaderSub} numberOfLines={1}>
                  {tracks.length} {tracks.length === 1 ? 'song' : 'songs'}
                </Text>
              </Pressable>

              {/* New Chat Button */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Start new chat"
                onPress={handleNewConversation}
                style={styles.chatHeaderBtn}
              >
                <Ionicons name="add" size={23} color={COLORS.gold} />
              </Pressable>

              {/* Settings Button */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Chatbot settings"
                onPress={() => setSettingsVisible(true)}
                style={styles.chatHeaderBtn}
              >
                <Ionicons name="settings-outline" size={19} color={COLORS.gold} />
              </Pressable>

              {/* Close Button */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close chat"
                onPress={closeChat}
                style={styles.chatHeaderBtn}
              >
                <Ionicons name="close" size={23} color={COLORS.cream} />
              </Pressable>
            </View>

            {/* Message List */}
            <ScrollView
              ref={scrollRef}
              style={styles.messageList}
              contentContainerStyle={[styles.messageListContent, { paddingBottom: insets.bottom + 80 }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {messages.map((msg, i) => (
                <ChatMessage
                  key={msg.id || i}
                  message={msg}
                  tracks={tracks}
                  onSongPress={handleSongPress}
                  onSpeak={handleToggleSpeak}
                  isSpeakingMessage={isSpeaking && speakingMessageId === (msg.id || msg.content)}
                />
              ))}
            </ScrollView>

            {/* Quick Suggestions (shown if conversation has only 1 message) */}
            {messages.length <= 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.suggestionsRow}
                style={styles.suggestions}
              >
                {['Happy & upbeat 🎉', 'Chill & relaxing 😌', 'Christmas vibes 🎄', 'Sad songs 😢', 'Something energetic 💪', 'Love songs 💕'].map((suggestion) => (
                  <Pressable
                    key={suggestion}
                    onPress={() => { setInput(suggestion); inputRef.current?.focus(); }}
                    style={({ pressed }) => [styles.suggestionChip, pressed && { opacity: 0.75 }]}
                  >
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {/* Input Bar */}
            <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
              <TextInput
                ref={inputRef}
                value={input}
                onChangeText={setInput}
                placeholder={isListening ? 'Listening... pause to send' : 'Tell me your mood...'}
                placeholderTextColor={isListening ? COLORS.red : COLORS.muted}
                style={styles.textInput}
                multiline
                maxLength={300}
                returnKeyType="send"
                onSubmitEditing={sendMessage}
                blurOnSubmit={false}
                editable={!isTyping && !isListening}
              />

              {/* TTS stop button — shown while speaking */}
              {isSpeaking && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Stop speaking"
                  onPress={stopSpeaking}
                  style={styles.micButton}
                >
                  <Ionicons name="volume-mute" size={20} color={COLORS.gold} />
                </Pressable>
              )}

              {/* Keep the stop button visible as speech fills the input. */}
              {(isListening || !input.trim()) && !isTyping && !isSpeaking && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isListening ? 'Finish speaking and send' : 'Speak a message and send automatically'}
                  onPress={isListening ? finishListening : startListening}
                  style={[styles.micButton, isListening && styles.micButtonRecording]}
                >
                  <Ionicons
                    name={isListening ? 'stop-circle' : 'mic-outline'}
                    size={20}
                    color={isListening ? COLORS.cream : COLORS.gold}
                  />
                </Pressable>
              )}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send message"
                onPress={sendMessage}
                disabled={!input.trim() || isTyping || isListening}
                style={({ pressed }) => [
                  styles.sendButton,
                  (!input.trim() || isTyping || isListening) && styles.sendButtonDisabled,
                  pressed && styles.sendButtonPressed,
                ]}
              >
                <Ionicons name={isTyping ? 'hourglass-outline' : 'send'} size={20} color={COLORS.cream} />
              </Pressable>
            </View>
          </ImageBackground>
        </KeyboardAvoidingView>
      </Modal>

      {/* ChatGPT / Claude Style Conversations Drawer / Modal */}
      <Modal
        visible={drawerVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setDrawerVisible(false)}
      >
        <View style={styles.drawerBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDrawerVisible(false)} />
          <View style={[styles.drawerPanel, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
            {/* Drawer Header */}
            <View style={styles.drawerHeader}>
              <View style={styles.drawerTitleRow}>
                <Ionicons name="chatbubbles" size={20} color={COLORS.gold} />
                <Text style={styles.drawerTitle}>Conversations</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close conversations"
                onPress={() => setDrawerVisible(false)}
                style={styles.drawerCloseBtn}
              >
                <Ionicons name="close" size={22} color={COLORS.cream} />
              </Pressable>
            </View>

            {/* "+ New Conversation" Button */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start new conversation"
              onPress={handleNewConversation}
              style={({ pressed }) => [styles.newChatBtn, pressed && styles.newChatBtnPressed]}
            >
              <Ionicons name="add-circle" size={20} color={COLORS.gold} />
              <Text style={styles.newChatBtnText}>New Conversation</Text>
            </Pressable>

            {/* List of Sessions */}
            <ScrollView style={styles.sessionsScroll} showsVerticalScrollIndicator={false}>
              {sessionsList.map((session) => {
                const isActive = session.id === currentSession?.id;
                return (
                  <View
                    key={session.id}
                    style={[styles.sessionItem, isActive && styles.sessionItemActive]}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Open conversation ${session.title}`}
                      onPress={() => handleSelectSession(session)}
                      style={styles.sessionItemMain}
                    >
                      <Ionicons
                        name={isActive ? 'chatbubble-ellipses' : 'chatbubble-outline'}
                        size={17}
                        color={isActive ? COLORS.gold : COLORS.cream}
                      />
                      <View style={styles.sessionItemTextCol}>
                        <Text numberOfLines={1} style={[styles.sessionItemTitle, isActive && styles.sessionItemTitleActive]}>
                          {session.title || 'Conversation'}
                        </Text>
                        <Text style={styles.sessionItemDate}>
                          {formatSessionDate(session.updatedAt)}
                        </Text>
                      </View>
                    </Pressable>

                    <View style={styles.sessionActions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Rename ${session.title}`}
                        onPress={() => promptRenameSession(session)}
                        style={styles.sessionActionBtn}
                      >
                        <Ionicons name="create-outline" size={16} color={COLORS.gold} />
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${session.title}`}
                        onPress={() => handleDeleteSession(session)}
                        style={styles.sessionActionBtn}
                      >
                        <Ionicons name="trash-outline" size={16} color="#e07a7a" />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            {/* Drawer Footer */}
            {sessionsList.length > 1 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear all conversations"
                onPress={handleClearAllSessions}
                style={styles.clearAllBtn}
              >
                <Ionicons name="trash-bin-outline" size={15} color="#e07a7a" />
                <Text style={styles.clearAllBtnText}>Clear all conversations</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>

      {/* Rename Conversation Modal */}
      <Modal
        visible={renameModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.settingsOverlay}
        >
          <View style={styles.settingsSheet}>
            <View style={styles.settingsHeader}>
              <Text style={styles.settingsTitle}>Rename Conversation</Text>
              <Pressable onPress={() => setRenameModalVisible(false)} style={styles.settingsClose}>
                <Ionicons name="close" size={22} color={COLORS.ink} />
              </Pressable>
            </View>

            <TextInput
              value={renameText}
              onChangeText={setRenameText}
              style={styles.settingsInput}
              placeholder="Conversation title"
              placeholderTextColor={COLORS.muted}
              autoFocus
              maxLength={40}
            />

            <View style={styles.renameActions}>
              <Pressable
                onPress={() => setRenameModalVisible(false)}
                style={[styles.renameBtn, styles.renameBtnCancel]}
              >
                <Text style={styles.renameBtnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirmRenameSession}
                style={[styles.renameBtn, styles.renameBtnConfirm]}
              >
                <Text style={styles.renameBtnConfirmText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Settings Modal */}
      <Modal
        visible={settingsVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSettingsVisible(false)}
      >
        <View style={styles.settingsOverlay}>
          <ScrollView
            contentContainerStyle={styles.settingsSheet}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.settingsHeader}>
              <Text style={styles.settingsTitle}>⚙️ MistleTunes Chatbot Settings</Text>
              <Pressable onPress={() => setSettingsVisible(false)} style={styles.settingsClose}>
                <Ionicons name="close" size={22} color={COLORS.ink} />
              </Pressable>
            </View>

            {/* Provider Switcher */}
            <Text style={styles.settingsLabel}>Chatbot Mode</Text>
            <View style={styles.providerToggleRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Use Built-In Mode"
                onPress={() => {
                  setAiProvider('nlp');
                  setTestResult(null);
                }}
                style={[
                  styles.providerBtn,
                  aiProvider === 'nlp' && styles.providerBtnActive,
                ]}
              >
                <Ionicons
                  name={aiProvider === 'nlp' ? 'sparkles' : 'sparkles-outline'}
                  size={18}
                  color={aiProvider === 'nlp' ? COLORS.gold : COLORS.green}
                />
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={[
                    styles.providerBtnText,
                    aiProvider === 'nlp' && styles.providerBtnTextActive,
                  ]}
                >
                  Built-In
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Use Online Mode"
                onPress={() => {
                  setAiProvider('groq');
                  setTestResult(null);
                }}
                style={[
                  styles.providerBtn,
                  aiProvider === 'groq' && styles.providerBtnActive,
                ]}
              >
                <Ionicons
                  name={aiProvider === 'groq' ? 'cloud' : 'cloud-outline'}
                  size={18}
                  color={aiProvider === 'groq' ? COLORS.gold : COLORS.green}
                />
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={[
                    styles.providerBtnText,
                    aiProvider === 'groq' && styles.providerBtnTextActive,
                  ]}
                >
                  Online
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Connect to Home Computer"
                onPress={() => {
                  setAiProvider('ollama');
                  setTestResult(null);
                }}
                style={[
                  styles.providerBtn,
                  aiProvider === 'ollama' && styles.providerBtnActive,
                ]}
              >
                <Ionicons
                  name={aiProvider === 'ollama' ? 'desktop' : 'desktop-outline'}
                  size={18}
                  color={aiProvider === 'ollama' ? COLORS.gold : COLORS.green}
                />
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={[
                    styles.providerBtnText,
                    aiProvider === 'ollama' && styles.providerBtnTextActive,
                  ]}
                >
                  Computer
                </Text>
              </Pressable>
            </View>

            {aiProvider === 'nlp' ? (
              <View style={styles.providerInfoBanner}>
                <Text style={styles.providerInfoTitle}>✨ Built-In (Recommended)</Text>
                <Text style={styles.providerInfoText}>
                  Works immediately right on your phone. Recommends songs for your mood with zero setup.
                </Text>
                <View style={styles.nlpFeatureList}>
                  <Text style={styles.nlpFeatureItem}>• ⚡ Instant recommendations with zero waiting</Text>
                  <Text style={styles.nlpFeatureItem}>• 📴 Works 100% offline without internet</Text>
                  <Text style={styles.nlpFeatureItem}>• 🔒 Completely private on your phone</Text>
                </View>
              </View>
            ) : aiProvider === 'groq' ? (
              <>
                <View style={styles.providerInfoBanner}>
                  <Text style={styles.providerInfoTitle}>🌐 Online Mode</Text>
                  <Text style={styles.providerInfoText}>
                    Enables free-form chatting and music trivia over the internet.
                  </Text>
                </View>

                <Text style={styles.settingsLabel}>Cloud Access Key</Text>
                <Text style={styles.settingsHint}>Free personal key from groq.com (enables online chat)</Text>
                <View style={styles.inputWithAction}>
                  <TextInput
                    value={groqApiKey}
                    onChangeText={(val) => {
                      setGroqApiKey(val);
                      setTestResult(null);
                    }}
                    style={[styles.settingsInput, { flex: 1 }]}
                    placeholder="Paste your key here..."
                    placeholderTextColor={COLORS.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry={!showGroqKey}
                  />
                  <Pressable
                    onPress={() => setShowGroqKey((prev) => !prev)}
                    style={styles.inputActionIcon}
                  >
                    <Ionicons
                      name={showGroqKey ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={COLORS.muted}
                    />
                  </Pressable>
                </View>

                <Text style={styles.settingsLabel}>Assistant Style (Optional)</Text>
                <Text style={styles.settingsHint}>Leave as default for standard high-speed mode</Text>
                <TextInput
                  value={groqModel}
                  onChangeText={setGroqModel}
                  style={styles.settingsInput}
                  placeholder="llama-3.1-8b-instant"
                  placeholderTextColor={COLORS.muted}
                  autoCapitalize="none"
                />
              </>
            ) : (
              <>
                <View style={styles.providerInfoBanner}>
                  <Text style={styles.providerInfoTitle}>💻 Desktop Computer Link</Text>
                  <Text style={styles.providerInfoText}>
                    Connects to an assistant running on your personal computer over home Wi-Fi.
                  </Text>
                </View>

                <Text style={styles.settingsLabel}>Computer Wi-Fi Address</Text>
                <Text style={styles.settingsHint}>Your computer&apos;s local address (e.g. http://192.168.1.xxx:11434)</Text>
                <TextInput
                  value={ollamaHost}
                  onChangeText={(val) => {
                    setOllamaHost(val);
                    setTestResult(null);
                  }}
                  style={styles.settingsInput}
                  placeholder="http://192.168.x.x:11434"
                  placeholderTextColor={COLORS.muted}
                  autoCapitalize="none"
                  keyboardType="url"
                />

                <Text style={styles.settingsLabel}>Assistant Name</Text>
                <Text style={styles.settingsHint}>The assistant installed on your computer</Text>
                <TextInput
                  value={ollamaModel}
                  onChangeText={(val) => {
                    setOllamaModel(val);
                    setTestResult(null);
                  }}
                  style={styles.settingsInput}
                  placeholder="phi4-mini"
                  placeholderTextColor={COLORS.muted}
                  autoCapitalize="none"
                />
              </>
            )}

            {/* Test Connection Button & Result Box for Online / Computer */}
            {aiProvider !== 'nlp' ? (
              <View style={styles.testSection}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Test Connection"
                  disabled={testingConnection}
                  onPress={() => handleTestConnection(aiProvider)}
                  style={({ pressed }) => [
                    styles.testButton,
                    testingConnection && styles.testButtonDisabled,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Ionicons
                    name={testingConnection ? 'hourglass-outline' : 'wifi-outline'}
                    size={17}
                    color={COLORS.cream}
                  />
                  <Text style={styles.testButtonText}>
                    {testingConnection ? 'Checking Connection...' : 'Test Connection'}
                  </Text>
                </Pressable>

                {testResult ? (
                  <View
                    style={[
                      styles.testResultBox,
                      testResult.success ? styles.testResultSuccess : styles.testResultError,
                    ]}
                  >
                    <Ionicons
                      name={testResult.success ? 'checkmark-circle' : 'alert-circle'}
                      size={18}
                      color={testResult.success ? '#0f5132' : '#842029'}
                      style={{ marginTop: 1 }}
                    />
                    <Text
                      style={[
                        styles.testResultText,
                        testResult.success ? styles.testResultTextSuccess : styles.testResultTextError,
                      ]}
                    >
                      {testResult.message}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <Pressable
              onPress={saveSettings}
              style={({ pressed }) => [styles.settingsSave, pressed && { opacity: 0.82 }]}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.cream} />
              <Text style={styles.settingsSaveText}>Save Settings</Text>
            </Pressable>

            {/* ── Voice & Speech ── */}
            <View style={styles.ttsDivider} />
            <Text style={styles.settingsLabel}>🔊 Voice & Speech (100% Free & Offline)</Text>

            {/* Text-to-Speech toggle */}
            <View style={styles.ttsToggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ttsToggleLabel}>Read Responses Aloud</Text>
                <Text style={styles.settingsHint}>The DJ speaks every reply out loud</Text>
              </View>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: ttsEnabled }}
                onPress={() => setTtsEnabled((v) => !v)}
                style={[styles.ttsToggle, ttsEnabled && styles.ttsToggleOn]}
              >
                <View style={[styles.ttsThumb, ttsEnabled && styles.ttsThumbOn]} />
              </Pressable>
            </View>

            {/* Voice gender picker & preview */}
            <Text style={[styles.settingsLabel, { marginTop: 14 }]}>Voice Tone</Text>
            <View style={styles.voicePickerRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Use female voice"
                onPress={() => {
                  setTtsVoice('female');
                  testVoiceSample('female');
                }}
                style={[styles.voiceBtn, ttsVoice === 'female' && styles.voiceBtnActive]}
              >
                <Ionicons
                  name="woman"
                  size={18}
                  color={ttsVoice === 'female' ? COLORS.gold : COLORS.green}
                />
                <Text style={[styles.voiceBtnText, ttsVoice === 'female' && styles.voiceBtnTextActive]}>
                  Female
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Use male voice"
                onPress={() => {
                  setTtsVoice('male');
                  testVoiceSample('male');
                }}
                style={[styles.voiceBtn, ttsVoice === 'male' && styles.voiceBtnActive]}
              >
                <Ionicons
                  name="man"
                  size={18}
                  color={ttsVoice === 'male' ? COLORS.gold : COLORS.green}
                />
                <Text style={[styles.voiceBtnText, ttsVoice === 'male' && styles.voiceBtnTextActive]}>
                  Male
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Test selected voice"
                onPress={() => testVoiceSample(ttsVoice)}
                style={styles.voiceTestBtn}
              >
                <Ionicons name="volume-medium-outline" size={17} color={COLORS.green} />
                <Text style={styles.voiceTestBtnText}>Test Voice</Text>
              </Pressable>
            </View>

            <Text style={styles.settingsFooter}>
              🔒 Your conversations are saved privately on this device.
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // FAB
  fab: {
    position: 'absolute',
    bottom: 180,
    right: 18,
    zIndex: 999,
    elevation: 10,
  },
  fabInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.red,
    borderWidth: 2.5,
    borderColor: COLORS.gold,
    shadowColor: COLORS.gold,
    shadowOpacity: 0.65,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  fabPressed: { opacity: 0.85, transform: [{ scale: 0.95 }] },
  fabBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.darkGreen,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.gold,
  },

  // Modal
  modalOverlay: { flex: 1 },
  chatScreen: { flex: 1, backgroundColor: 'rgba(5,30,18,0.92)' },

  // Header
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: 'rgba(5,25,15,0.94)',
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.gold,
  },
  chatHeaderInfo: { flex: 1, minWidth: 0, paddingHorizontal: 4 },
  chatHeaderTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chatHeaderTitle: { color: COLORS.cream, fontFamily: 'NunitoExtraBold', fontSize: 14, flexShrink: 1 },
  chatHeaderSub: { color: COLORS.gold, fontFamily: 'NunitoSemiBold', fontSize: 10, marginTop: 1 },
  chatHeaderBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },

  // Messages
  messageList: { flex: 1 },
  messageListContent: { paddingHorizontal: 14, paddingTop: 14, gap: 12 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowUser: { flexDirection: 'row-reverse' },
  aiAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.green,
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    flexShrink: 0,
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  bubbleUser: {
    backgroundColor: COLORS.red,
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(242,187,79,0.3)',
  },
  bubbleAI: {
    backgroundColor: COLORS.aiHue,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(242,187,79,0.4)',
  },
  typingBubble: { paddingVertical: 14 },
  bubbleText: {
    color: COLORS.cream,
    fontFamily: 'NunitoSemiBold',
    fontSize: 13.5,
    lineHeight: 20,
  },
  bubbleTextUser: { color: '#fff' },
  systemMsg: { alignItems: 'center', marginVertical: 4 },
  systemMsgText: {
    color: COLORS.gold,
    fontFamily: 'NunitoSemiBold',
    fontSize: 11,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },

  // Song chips inside messages
  songChips: { marginTop: 10, gap: 6 },
  songChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(10,80,45,0.95)',
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  songChipPressed: { opacity: 0.78 },
  songChipDisabled: {
    backgroundColor: 'rgba(100,90,70,0.3)',
    borderColor: 'rgba(242,187,79,0.3)',
  },
  songChipText: {
    color: COLORS.cream,
    fontFamily: 'NunitoBold',
    fontSize: 12,
    flexShrink: 1,
  },
  songChipTextDisabled: { color: COLORS.muted },

  // Suggestions
  suggestions: { flexGrow: 0, flexShrink: 0 },
  suggestionsRow: { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  suggestionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(10,55,32,0.9)',
    borderWidth: 1.5,
    borderColor: COLORS.gold,
  },
  suggestionText: {
    color: COLORS.cream,
    fontFamily: 'NunitoBold',
    fontSize: 12,
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: 'rgba(5,25,15,0.95)',
    borderTopWidth: 1.5,
    borderTopColor: COLORS.gold,
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(255,248,233,0.95)',
    color: COLORS.ink,
    fontFamily: 'NunitoSemiBold',
    fontSize: 13,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.red,
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    elevation: 2,
  },
  sendButtonDisabled: { backgroundColor: '#4a3028', borderColor: 'rgba(242,187,79,0.3)' },
  sendButtonPressed: { opacity: 0.8 },

  // Conversations Drawer / Sidebar
  drawerBackdrop: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  drawerPanel: {
    width: '84%',
    maxWidth: 340,
    backgroundColor: '#072418',
    borderRightWidth: 2,
    borderRightColor: COLORS.gold,
    paddingHorizontal: 16,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(242,187,79,0.25)',
  },
  drawerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  drawerTitle: { color: COLORS.cream, fontFamily: 'NunitoExtraBold', fontSize: 18 },
  drawerCloseBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },

  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 14,
    paddingVertical: 11,
    borderRadius: 18,
    backgroundColor: COLORS.red,
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    shadowColor: COLORS.gold,
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  newChatBtnPressed: { opacity: 0.85 },
  newChatBtnText: { color: COLORS.cream, fontFamily: 'NunitoExtraBold', fontSize: 13.5 },

  sessionsScroll: { flex: 1 },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    marginBottom: 6,
    backgroundColor: 'rgba(255,248,233,0.06)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sessionItemActive: {
    backgroundColor: 'rgba(14,68,42,0.85)',
    borderColor: COLORS.gold,
  },
  sessionItemMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  sessionItemTextCol: { flex: 1, minWidth: 0 },
  sessionItemTitle: { color: COLORS.cream, fontFamily: 'NunitoSemiBold', fontSize: 13 },
  sessionItemTitleActive: { color: COLORS.gold, fontFamily: 'NunitoExtraBold' },
  sessionItemDate: { color: 'rgba(255,248,233,0.5)', fontFamily: 'NunitoRegular', fontSize: 10, marginTop: 2 },
  sessionActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sessionActionBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },

  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(142,20,32,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(224,122,122,0.4)',
  },
  clearAllBtnText: { color: '#e07a7a', fontFamily: 'NunitoSemiBold', fontSize: 12 },

  // Rename Modal
  renameActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  renameBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  renameBtnCancel: { backgroundColor: '#e2d2ad' },
  renameBtnCancelText: { color: COLORS.ink, fontFamily: 'NunitoBold', fontSize: 13 },
  renameBtnConfirm: { backgroundColor: COLORS.green, borderWidth: 1, borderColor: COLORS.gold },
  renameBtnConfirmText: { color: COLORS.cream, fontFamily: 'NunitoExtraBold', fontSize: 13 },

  // Settings sheet
  settingsOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  settingsSheet: {
    backgroundColor: COLORS.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 8,
    borderTopWidth: 2,
    borderTopColor: COLORS.gold,
  },
  settingsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  settingsTitle: { flex: 1, color: COLORS.ink, fontFamily: 'NunitoExtraBold', fontSize: 18 },
  settingsClose: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  settingsLabel: { color: COLORS.ink, fontFamily: 'NunitoExtraBold', fontSize: 13, marginTop: 10 },
  settingsHint: { color: COLORS.muted, fontFamily: 'NunitoRegular', fontSize: 11, marginBottom: 4 },
  settingsInput: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    color: COLORS.ink,
    fontFamily: 'NunitoSemiBold',
    fontSize: 13,
    backgroundColor: '#fff',
  },
  settingsSave: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: COLORS.green,
    borderWidth: 1.5,
    borderColor: COLORS.gold,
  },
  settingsSaveText: { color: COLORS.cream, fontFamily: 'NunitoExtraBold', fontSize: 14 },
  settingsFooter: {
    color: COLORS.muted,
    fontFamily: 'NunitoRegular',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 17,
  },
  providerToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    marginBottom: 8,
  },
  providerBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: 'rgba(242,187,79,0.5)',
  },
  providerBtnActive: {
    backgroundColor: COLORS.green,
    borderColor: COLORS.gold,
    elevation: 3,
    shadowColor: COLORS.gold,
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  providerBtnText: {
    color: COLORS.ink,
    fontFamily: 'NunitoBold',
    fontSize: 11,
    textAlign: 'center',
  },
  providerBtnTextActive: {
    color: COLORS.cream,
    fontFamily: 'NunitoExtraBold',
  },
  providerInfoBanner: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(15,61,40,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(15,61,40,0.18)',
    marginTop: 4,
    marginBottom: 4,
  },
  providerInfoTitle: {
    color: COLORS.green,
    fontFamily: 'NunitoExtraBold',
    fontSize: 12,
    marginBottom: 2,
  },
  providerInfoText: {
    color: COLORS.muted,
    fontFamily: 'NunitoRegular',
    fontSize: 11,
    lineHeight: 15,
  },
  inputWithAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputActionIcon: {
    position: 'absolute',
    right: 12,
    height: 44,
    justifyContent: 'center',
  },
  nlpFeatureList: {
    marginTop: 8,
    gap: 3,
  },
  nlpFeatureItem: {
    color: COLORS.green,
    fontFamily: 'NunitoSemiBold',
    fontSize: 11,
    lineHeight: 16,
  },
  testSection: {
    marginTop: 12,
    gap: 8,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: COLORS.red,
    borderWidth: 1.5,
    borderColor: COLORS.gold,
  },
  testButtonDisabled: {
    opacity: 0.6,
  },
  testButtonText: {
    color: COLORS.cream,
    fontFamily: 'NunitoBold',
    fontSize: 13,
  },
  testResultBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  testResultSuccess: {
    backgroundColor: '#d4edda',
    borderColor: '#c3e6cb',
  },
  testResultError: {
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
  },
  testResultText: {
    flex: 1,
    fontFamily: 'NunitoSemiBold',
    fontSize: 12,
    lineHeight: 16,
  },
  testResultTextSuccess: {
    color: '#155724',
  },
  testResultTextError: {
    color: '#721c24',
  },

  // Mic button
  micButton: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(10,55,32,0.6)',
    borderWidth: 1.5,
    borderColor: COLORS.gold,
  },
  micButtonRecording: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.cream,
  },

  // TTS section
  ttsDivider: {
    height: 1,
    backgroundColor: 'rgba(10,55,32,0.15)',
    marginVertical: 18,
    marginHorizontal: -4,
  },
  ttsToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  ttsToggleLabel: {
    color: COLORS.ink,
    fontFamily: 'NunitoBold',
    fontSize: 13,
  },
  ttsToggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ccc',
    padding: 3,
    justifyContent: 'center',
  },
  ttsToggleOn: {
    backgroundColor: COLORS.green,
  },
  ttsThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  ttsThumbOn: {
    alignSelf: 'flex-end',
  },

  // Voice gender picker
  voicePickerRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  voiceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.green,
    backgroundColor: 'rgba(10,55,32,0.07)',
  },
  voiceBtnActive: {
    backgroundColor: COLORS.green,
    borderColor: COLORS.gold,
  },
  voiceBtnText: {
    color: COLORS.green,
    fontFamily: 'NunitoBold',
    fontSize: 13,
  },
  voiceBtnTextActive: {
    color: COLORS.cream,
  },
  voiceTestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.green,
    backgroundColor: 'rgba(10,55,32,0.08)',
  },
  voiceTestBtnText: {
    color: COLORS.green,
    fontFamily: 'NunitoBold',
    fontSize: 12,
  },
  aiBubbleActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,248,233,0.18)',
  },
  msgSpeakBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,248,233,0.12)',
  },
  msgSpeakBtnActive: {
    backgroundColor: 'rgba(242,187,79,0.25)',
    borderColor: COLORS.gold,
    borderWidth: 1,
  },
  msgSpeakBtnText: {
    color: 'rgba(255,248,233,0.85)',
    fontFamily: 'NunitoSemiBold',
    fontSize: 11,
  },
  msgSpeakBtnTextActive: {
    color: COLORS.gold,
    fontFamily: 'NunitoBold',
  },
});
