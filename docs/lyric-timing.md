# Word timing

Each generated word has start/end seconds from the same recording used by the
player. `useKaraokeClock` samples `AudioPlaylist.currentTime` on animation frames,
converts seconds to milliseconds, and writes directly to a Reanimated shared
value. React state is used for line scrolling and controls, never word progress.
Sampling stops in the background. Pause, buffering, seeking and repeat follow the
native position without a free-running timer or extrapolation.

`effectiveTimeMs = currentTimeMs - (outputOffsetMs + songOffsetMs) + 50`.
Negative offsets show lyrics earlier. Output compensation defaults to -150 ms;
each song starts at 0 ms additional correction. Both settings persist separately,
with Earlier/Later buttons in 50 ms steps and Reset for each scope. The 50 ms
lookahead is applied once. Lyric taps invert the same formula; slider seeks use
the unmodified audio position. Defaults are tunable estimates, not measured
hardware latency. Bluetooth and different output routes can need different settings.

The word sweep clamps `(effectiveTimeMs - startMs) / (endMs - startMs)` to [0, 1].
Native platforms use a static glyph mask and a translated gold layer, avoiding
per-frame text layout or changing font sizes. Only nearby lyric lines mount
animated words. Reduced motion uses a discrete color change. Web uses a clipping
fallback. Imported line-only LRC has no invented word timestamps.

This is display-frame sampling, not a sample-accurate audio-output clock. Expo's
position getter is read from the JS runtime; a blocked JS thread can delay new
samples even though Reanimated renders on the UI thread. Whisper's approximate
word-timestamp resolution and singing recognition also limit alignment accuracy.
No universal offset can guarantee frame-accurate phonetic boundaries.

## Lyrics sources (in priority order)

1. **Internet synced lyrics** — exact words and line-level timing from online
   providers via the `syncedlyrics` package (Musixmatch, NetEase, LRCLIB,
   Megalobiz, Genius), tried before any ASR pass. Direct LRCLIB search with
   candidate scoring is the fallback. Enhanced LRC word tags produce real
   per-word times when available (rare); plain LRC lines spread words across
   the line weighted by length. Wrong-version matches are rejected by a
   duration sanity check (last line must sit inside the song). This path needs
   no inference and is the most accurate option when the song exists online.
2. **Groq Cloud whisper-large-v3** (`server/server.py`) — used when LRCLIB has
   no confident match. The upload goes to Groq with word + segment timestamps
   and a title/artist prompt. A karaoke-captions-style layout engine groups
   words into breath-aligned lines of at most 7 words (sentence/pause breaks,
   legato glide ≤ 0.20 s, line hold clamped to the next line, oversized words
   capped, symbol-only tokens such as 🎵/… dropped, line boundaries enforced
   non-overlapping). The Groq path requires `groq>=1.7.0` (see
   `server/requirements.txt`) and a key in `server/config.json`.

Audio over 24 MB is re-encoded to 64k mono MP3 before upload. The 10-minute
and 100 MB upload limits still apply.

Singing recognition is not guaranteed to match the authoritative lyrics;
whisper can still transcribe instrumental tails as words. LRCLIB matches are
exact for words and timing; Groq results are approximate. Use Refresh
timing in Lyrics to regenerate a song after pipeline changes.

After dependency installation restart Metro with `npx expo start --clear` and
reload SDK 58 Expo Go. Existing custom development/release builds need rebuilding
to include Reanimated, Worklets and MaskedView. Restart the local Python service
after pipeline changes. Verify on device with rapid words, sustained notes,
silences, seeks, pause/resume, repeat, and the intended speaker/headphone route.

whisper-large-v3 is multilingual, but singing in under-represented languages
(e.g. Tagalog) can still be inaccurate. Songs with a confident LRCLIB match get
exact words regardless of language; everything else depends on the ASR.

Responses and generated caches record `timingVersion: 7`. Folder imports refresh
older generated results when the local server is reachable. Imported lyrics are
retained. Lyrics are cached on the phone after generation, so playback does not
run inference again.

## Setup and operation

On Windows: `cd server`, then `.venv\Scripts\python.exe -m pip install -r requirements.txt`
(needs `flask`, `groq>=1.7.0`, `av`), put your Groq key in `server/config.json`
(`{"groq_api_key": "..."}`), and run `server/start-server.bat`. The LRCLIB path
needs no key and is attempted before Groq for every request.

The phone and computer must be on the same Wi-Fi network. During Expo development,
the app detects the Metro computer address. Installed builds use the configured
LAN fallback in `components/serverTranscription.js`.

Playback uses saved results without running inference. Opening Lyrics refreshes an
older generated result when the service is available. Timing correction controls
adjust the shared playback offset without rewriting the model's word times.

References: [LRCLIB](https://lrclib.net),
[whisper-large-v3 on Groq](https://console.groq.com/docs/speech-text),
[Expo SDK 58 audio](https://docs.expo.dev/versions/v58.0.0/sdk/audio/).
