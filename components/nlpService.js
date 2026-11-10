/**
 * On-Device NLP (Natural Language Processing) Music Recommendation Engine
 *
 * Runs 100% on-device in pure JavaScript with ZERO network calls, ZERO servers,
 * and ZERO API keys required.
 *
 * Features:
 *  - Sentiment & Mood detection (Happy/Upbeat, Calm/Acoustic, Sad/Melancholy, Christmas, Romantic, Workout)
 *  - Entity extraction (detects if user asked for a specific artist or title in their library)
 *  - Semantic keyword relevance scoring across tracks (title, artist, album)
 *  - Natural festive response generator formatted with [SONG: Title] tags
 *  - Streaming simulation callback for consistent UI animations
 */

const MOOD_TAXONOMY = {
  christmas: {
    label: 'festive Christmas',
    keywords: [
      'christmas', 'holiday', 'xmas', 'santa', 'winter', 'snow', 'cold', 'december',
      'festive', 'mistletoe', 'bell', 'tree', 'carol', 'cheer', 'reindeer', 'jingle',
      'noel', 'yule', 'wonderland', 'frosty', 'merry', 'claus', 'sleigh'
    ],
    greeting: '🎄 Ho ho ho! Getting into the holiday spirit? Here are festive tracks from your library to warm you up:',
    advice: 'Grab a mug of hot cocoa and enjoy the holiday melodies!',
  },
  happy: {
    label: 'upbeat & joyful',
    keywords: [
      'happy', 'party', 'dance', 'fun', 'upbeat', 'hype', 'energy', 'cheer', 'celebrate',
      'joy', 'excited', 'bounce', 'club', 'good mood', 'positive', 'groove', 'smile',
      'sunshine', 'alive', 'vibe', 'vibes', 'turn up', 'lit', 'pop', 'disco', 'shake',
      'summer', 'bright', 'jump', 'move', 'dynamite'
    ],
    greeting: '✨ Nothing beats good energy! Here are some upbeat tracks to keep your spirits flying high:',
    advice: 'Turn up the volume and let the positive vibes roll!',
  },
  calm: {
    label: 'chill & relaxing',
    keywords: [
      'chill', 'relax', 'calm', 'peace', 'peaceful', 'soft', 'slow', 'sleep', 'night',
      'bed', 'study', 'focus', 'acoustic', 'quiet', 'smooth', 'cozy', 'lazy', 'unwind',
      'meditate', 'rest', 'soothing', 'gentle', 'serene', 'piano', 'ambient', 'rain',
      'lofi', 'guitar', 'breeze', 'mellow'
    ],
    greeting: '☕ I feel you. Taking a breather is always a great idea. Here are soothing tunes to help you relax:',
    advice: 'Dim the lights, breathe easy, and let the soothing sounds wash over you.',
  },
  sad: {
    label: 'gentle & comforting',
    keywords: [
      'sad', 'cry', 'crying', 'heartbreak', 'broken', 'miss', 'alone', 'lonely', 'pain',
      'tears', 'hurt', 'melancholy', 'dark', 'depressed', 'down', 'blue', 'gloomy',
      'heartbroken', 'sorrow', 'tough day', 'rough day', 'bad day', 'cry', 'goodbye',
      'lost', 'teardrop', 'sorry', 'hurt', 'regret'
    ],
    greeting: '💙 Music is always here to heal and comfort. Here are deep, soulful songs for your mood:',
    advice: 'Remember that after every winter snow comes a warm spring. Take good care of yourself!',
  },
  romantic: {
    label: 'romantic & loving',
    keywords: [
      'love', 'romantic', 'crush', 'date', 'sweetheart', 'kiss', 'forever', 'sweet',
      'heart', 'passion', 'romance', 'lover', 'together', 'hug', 'warmth', 'couple',
      'darling', 'beloved', 'mine', 'baby', 'honey'
    ],
    greeting: '💖 Love is in the air! Here are sweet and romantic songs to set the mood:',
    advice: 'Perfect tunes for creating special memories with someone you cherish.',
  },
  workout: {
    label: 'high energy & powerful',
    keywords: [
      'workout', 'gym', 'run', 'running', 'hard', 'loud', 'bass', 'intense', 'pump',
      'beast', 'training', 'power', 'fast', 'heavy', 'drive', 'speed', 'lift', 'rock',
      'tiger', 'fight', 'warrior', 'fire', 'strong', 'beast', 'drop', 'push', 'hit'
    ],
    greeting: '🔥 Time to lock in! Here are high-octane tracks to give you that extra boost:',
    advice: 'Keep that momentum going — you got this!',
  },
};

const GREETING_KEYWORDS = [
  'hi', 'hello', 'hey', 'sup', 'yo', 'good morning', 'good afternoon', 'good evening',
  'howdy', 'greetings', 'ho ho ho'
];

/**
 * Tokenize and normalize input text into lowercase alphanumeric words
 */
function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

/**
 * Detect the primary mood from user message tokens
 */
function detectMood(tokens) {
  const scores = {};
  for (const [moodKey, config] of Object.entries(MOOD_TAXONOMY)) {
    scores[moodKey] = 0;
    for (const token of tokens) {
      if (config.keywords.includes(token)) {
        scores[moodKey] += 2;
      } else {
        // Partial match
        for (const kw of config.keywords) {
          if (kw.length >= 4 && (token.includes(kw) || kw.includes(token))) {
            scores[moodKey] += 1;
            break;
          }
        }
      }
    }
  }

  let topMood = null;
  let maxScore = 0;
  for (const [moodKey, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      topMood = moodKey;
    }
  }

  return maxScore > 0 ? topMood : null;
}

/**
 * Check if the user is asking for a specific artist or title present in the library
 */
function findDirectEntities(userText, tracks) {
  const normalizedText = (userText || '').toLowerCase();
  const matchedArtists = new Set();
  const matchedTracks = [];

  for (const track of tracks) {
    const artist = (track.artist || '').toLowerCase().trim();
    if (artist && artist !== 'unknown artist' && normalizedText.includes(artist)) {
      matchedArtists.add(track.artist);
    }
    const title = (track.title || '').toLowerCase().trim();
    if (title && title.length > 2 && normalizedText.includes(title)) {
      matchedTracks.push(track);
    }
  }

  return {
    artists: Array.from(matchedArtists),
    tracks: matchedTracks,
  };
}

/**
 * Rank tracks based on detected mood, entities, and keyword relevance
 */
function rankTracks(tracks, mood, entities, queryTokens) {
  const moodConfig = mood ? MOOD_TAXONOMY[mood] : null;

  const scored = tracks.map((track) => {
    let score = 0;
    const titleLower = (track.title || '').toLowerCase();
    const artistLower = (track.artist || '').toLowerCase();
    const albumLower = (track.album || '').toLowerCase();
    const trackText = `${titleLower} ${artistLower} ${albumLower}`;

    // 1. Entity match: artist mentioned directly
    if (entities.artists.some((a) => artistLower.includes(a.toLowerCase()))) {
      score += 15;
    }

    // 2. Entity match: title mentioned directly
    if (entities.tracks.some((t) => t.id === track.id)) {
      score += 25;
    }

    // 3. Mood keyword matches in title/album/artist
    if (moodConfig) {
      for (const kw of moodConfig.keywords) {
        if (trackText.includes(kw)) {
          score += 6;
        }
      }
    }

    // 4. Query token overlap
    for (const token of queryTokens) {
      if (['play', 'song', 'music', 'recommend', 'listen', 'want', 'give'].includes(token)) continue;
      if (titleLower.includes(token)) score += 4;
      if (artistLower.includes(token)) score += 3;
      if (albumLower.includes(token)) score += 2;
    }

    // Small deterministic jitter based on track id so ties distribute evenly
    const jitter = (track.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 5) * 0.1;

    return { track, score: score + jitter };
  });

  scored.sort((a, b) => b.score - a.score);

  // Return the top 3-4 scoring tracks
  return scored
    .filter((s) => s.score > 0)
    .slice(0, 4)
    .map((s) => s.track);
}

/**
 * Chat with On-Device NLP engine.
 * Simulates streaming so the UI gets the same smooth typing effect.
 */
export async function chatWithNlp(userMessage, tracks, onToken = null) {
  if (!tracks || tracks.length === 0) {
    const emptyReply = `🎄 Ho ho ho! I'm your MistleTunes DJ!\n\nYour library doesn't have any songs yet. Go to Settings, choose your music folder, and tap Rescan. Once you have songs, I'll recommend the best tracks for any mood! 🎵`;
    onToken?.(emptyReply);
    return emptyReply;
  }

  const queryTokens = tokenize(userMessage);
  const detectedMood = detectMood(queryTokens);
  const entities = findDirectEntities(userMessage, tracks);

  // Check if it's just a greeting
  const isOnlyGreeting = queryTokens.length <= 3 && queryTokens.some((t) => GREETING_KEYWORDS.includes(t));

  let reply = '';

  if (isOnlyGreeting && !detectedMood && entities.artists.length === 0 && entities.tracks.length === 0) {
    const sample = tracks.slice(0, 3);
    const samplePicks = sample
      .map((t) => `• [SONG: ${t.title}] by ${t.artist || 'Unknown'}`)
      .join('\n');

    reply = `🎄 Ho ho ho! Hello there! I'm your MistleTunes DJ! 🎅\n\nI can see ${tracks.length} great tracks in your library.\n\nTell me: what's your mood right now? (Happy, Chill, Sad, Romantic, Workout, or Christmas)? Or tell me how your day went!\n\nHere are a few quick picks from your library:\n${samplePicks}\n\nTap any song above to search and play it! ✨`;
  } else {
    let recommended = rankTracks(tracks, detectedMood, entities, queryTokens);

    // If no strong matches, pick a varied selection
    if (recommended.length === 0) {
      recommended = tracks.slice(0, 3);
    }

    const songLines = recommended
      .map((t, idx) => `${idx + 1}. [SONG: ${t.title}] by ${t.artist || 'Unknown'}`)
      .join('\n');

    if (entities.artists.length > 0) {
      const artistName = entities.artists[0];
      reply = `🎵 You got it! Here are top tracks by ${artistName} from your collection:\n\n${songLines}\n\nTap any song above to start jamming! 🎶`;
    } else if (detectedMood) {
      const config = MOOD_TAXONOMY[detectedMood];
      reply = `${config.greeting}\n\n${songLines}\n\n💡 Tip: ${config.advice}\n\nTap any song card above to jump straight into it! 🎁`;
    } else {
      reply = `✨ I scanned your library for your request! Here are the best tracks to fit the moment:\n\n${songLines}\n\nTell me if you want something faster, softer, or in a different mood! 🎵`;
    }
  }

  // Simulate smooth token streaming for rich UI feel
  if (onToken) {
    const words = reply.split(' ');
    let streamed = '';
    for (let i = 0; i < words.length; i++) {
      streamed += (i === 0 ? '' : ' ') + words[i];
      onToken(streamed);
      if (i % 3 === 0) {
        await new Promise((res) => setTimeout(res, 20));
      }
    }
  }

  return reply;
}
