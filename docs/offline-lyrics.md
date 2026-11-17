# Offline lyrics with bundled Whisper

Playback remains **expo-audio**. Lyrics use **react-native-executorch 0.11.0**, its
timestamp-capable `/legacy` SpeechToTextModule (the imperative counterpart of
useSpeechToText), **react-native-audio-api 1.0.0** for decoding, and
**expo-file-system** for persistent JSON. No lyrics model, tokenizer, audio, or
transcript is fetched from or uploaded to the internet at runtime. The adapter
rejects remote URLs and disables the library's download counter path.

## Files and flow

- `assets/models/index.js`: static `require()` references to the real bundled
  multilingual Whisper Tiny PTE and tokenizer. The tokenizer is JSON stored with
  a `.bin` suffix so Metro bundles a file, rather than importing a JS object.
- `scripts/setup-lyrics-models.mjs`: **build-machine-only** provisioning. Downloads
  the official v0.10.0 legacy model contract, verifies exact sizes and SHA-256,
  and writes the manifest. This script is never part of the mobile app.
- `components/bundledWhisper.js`: resolves embedded require assets to native file
  paths, rejects HTTP/Metro asset URLs, and registers an offline-only adapter.
- `components/offlineTranscription.js`: serialized engine, local decoding,
  stereo averaging, on-device language detection, timestamp extraction, progress,
  cancellation between native operations, and resource cleanup.
- `components/generatedLyricsCache.js`: JSON under app documents
  `GeneratedLyrics/v2/`. Identity includes library, track ID, local URI, file size,
  modification time, and model version. Corrupt/stale results regenerate; an
  empty instrumental result is also cached. Hash collisions are checked against
  the full identity before using a result.
- `components/PlaybackContext.jsx` and `LyricsPreparationOverlay.jsx`: selected
  songs check imported lyrics/cache before playback. A cache miss pauses playback,
  generates/saves lyrics, then starts the original player automatically. App
  Next/Previous use the same flow. Native playlist auto-advance and notification
  controls retain uninterrupted background playback; a previously unseen song
  reached through those paths gets lyrics when explicitly selected in the app.
  Previously generated lyrics still display from cache. Podcasts and nonlocal
  sources retain their previous playback path. Failure offers Cancel or Play
  without lyrics.
- `components/SyncedLyricsView.jsx` and `LyricsScreen.jsx`: full lyrics, highlighting
  only inside `[start, end]`, follow-scroll, tap-to-seek, immediate seek preview,
  artwork, title, artist, and original playback controls. Imported LRC/TXT remains
  available. Removing lyrics and selecting the track again regenerates them.

The decoder API changed: version 1.0 uses standalone
`decodeAudioData(localUri, 16000)`, instead of the older
`AudioContext.decodeAudioDataSource`. It avoids creating another playback audio
context/session. Samples are averaged to mono as Float32Array before inference.

ExecuTorch's new 0.11 speech API returns plain text. Its shipped `/legacy` module
still returns native `segments` with seconds when `verbose: true`. Pinning 0.11.0
prevents an update silently removing that API. The native decode method reads
uint64 tokens although its TypeScript signature says Int32Array; language
detection supplies an aligned 64-bit slot to match the actual native contract.

## Provision the model

The actual files have already been placed in this working copy. On a new checkout:

```powershell
cd C:\mistletune-main
npm ci
npm run lyrics:models
```

That command downloads **only on your computer/build machine**:

```text
https://huggingface.co/software-mansion/react-native-executorch-whisper-tiny/resolve/v0.10.0/xnnpack/whisper_tiny_xnnpack_fp32.pte
  -> assets/models/whisper-tiny.pte (232,609,280 bytes)
https://huggingface.co/software-mansion/react-native-executorch-whisper-tiny/resolve/v0.10.0/tokenizer.json
  -> assets/models/whisper-tokenizer.bin (2,480,466 bytes)
```

For an air-gapped build computer, copy these two verified files from another
computer into those exact paths and run the same setup command: it validates
existing files without downloading. The model and tokenizer add approximately
224 MiB before APK compression. The weight files are Git-ignored (the PTE exceeds
GitHub's ordinary file limit), but explicitly included by `.easignore` for EAS
uploads. EAS's post-install hook also provisions/verifies models on its build
machine. `metro.config.js` accepts PTE/BIN assets.

## Build and test

Expo Go cannot execute these native libraries. EAS can build the installed APK
without a local Android SDK:

```powershell
npm run lyrics:models
npx expo prebuild --platform android
npx eas-cli@latest build --platform android --profile apk-production
```

Install the resulting APK, import a local song, enable airplane mode, and select
the song. Generation must finish before playback starts. Open Lyrics, seek forward
and backward, then select the same song again to verify cache reuse after an app
restart.

Local Android rebuild (requires JDK and Android SDK):

```powershell
npm run lyrics:models
npx expo prebuild --platform android
npx expo run:android --variant release
```

For a development client, use `npx expo run:android` followed by
`npx expo start --dev-client`. **Metro serves assets over HTTP in normal debug
mode.** The strict resolver deliberately refuses those model URLs; it will not
download a model even from your development server. Use the embedded **release
APK** above to test fully offline generation. A development client alone does not
prove assets are embedded or offline.

On macOS with Xcode, iOS release build:

```sh
npm run lyrics:models
npx expo prebuild --platform ios
npx expo run:ios --configuration Release
```

Do not use `prebuild --clean` on this project without preserving existing native
customizations. Native directories already exist. For new native builds, the
ExecuTorch dependency's own install hook downloads its **build-time** native
libraries; package.json restricts backends to CPU XNNPACK, with OpenCV/phonemis/
Vulkan/CoreML/MLX disabled. These downloads are not app-runtime downloads. If a
package manager skipped that dependency hook, run it before building:

```powershell
node node_modules/react-native-executorch/scripts/download-libs.js
```

## Practical limits and validation

Whisper transcribes speech, not a guaranteed authoritative lyric source. Singing,
instruments, overlapping vocals, silence, and mixed languages can produce wrong
words or approximate timestamps. No-vocals results are cached too. First generation
can take minutes, depending on the phone; cache reuse avoids inference. A device
must have sufficient RAM for native model inference. The decoder reads the file
into memory at 16 kHz before processing short windows, so files are limited to
32 MiB compressed and 8 minutes. These bounds reduce risk but do not guarantee
every low-memory phone can run Whisper.

Selecting another track cancels the old request. Native inference finishes its
current operation before unloading; a newer job waits before allocating another
model. Backgrounding stops generation and requires a retry. Cancelled requests
never start stale playback. Skipping lyrics does not change the audio player or
chatbot microphone implementation. This feature makes **lyric generation** offline;
it does not change unrelated networking/update behavior elsewhere in the app.

```powershell
npm run test:lyrics
npx expo lint
npx tsc --noEmit
```

The JavaScript project currently has no tsconfig.json, so the final command prints
TypeScript help instead of type-checking a configured project. Native inference,
airplane-mode startup, English/Filipino transcription, memory use, cancellation,
media notification controls, podcasts, and chatbot behavior still require device
testing. JavaScript tests mock native engines; they do not prove native compatibility
or transcription accuracy.

References:
- https://docs.expo.dev/versions/v58.0.0/sdk/asset/
- https://docs.swmansion.com/react-native-executorch/docs/extensions/speech-to-text
- https://docs.swmansion.com/react-native-audio-api/docs/utils/decoding/
