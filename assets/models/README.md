# Bundled offline lyrics

The app uses multilingual Whisper Tiny with react-native-executorch 0.8.0. The
model is already placed here: whisper_tiny_xnnpack.pte (232,615,296 bytes), plus
whisper_tiny_tokenizer.bin (JSON tokenizer, stored as a binary Metro asset).
Do not use Whisper constants with remote URLs in the app.

To restore/verify these build assets on a fresh checkout, run:

    node scripts/prepare-offline-models.mjs

This setup script uses internet on the development computer only, verifies SHA-256
checksums, and is never part of the application runtime. Both files are bundled
through literal require() calls; metro.config.js already accepts pte and bin.
The stock expo-asset config plugin does not accept these model extensions.

Build a standalone Android APK from the project root:

    npx eas-cli@latest build --platform android --profile preview

A new APK is required after adding the native library. Expo Go can still import
and play music and display saved/imported lyrics, but cannot run the generator.
A Metro-only development build does not embed its served model assets; use the
standalone APK to test generation with airplane mode enabled from first launch.
If generating native projects locally, use npx expo prebuild followed by
npx expo run:android --variant release. Generated native directories must not be
edited by hand.

The offline service rejects remote resources, uses numeric bundled asset IDs
(which bypass ExecuTorch URL download counters), copies resources to app-private
storage, and runs one native model at a time. An OfflineAudioContext decodes local
MP3 audio at 16 kHz without opening another playback output session. Audio API
1.0 names this method decodeAudioData (decodeAudioDataSource is no longer the
native API name). No microphone, Groq key, Python server, or LAN address is used.

Lyrics reuse the existing JSON cache and existing playback clock/seek UI. Saved
lyrics made earlier are retained and can be displayed without internet. Generation
uses acoustic segment/word times; it does not invent evenly spaced timestamps.
Each song is capped at 8 minutes/64 MB to limit decode memory, processed in 28-second
chunks, and releases its model afterward. Transcribing singing may be inaccurate,
particularly with loud backing music. Native performance and accuracy require
physical-device testing; successful JavaScript checks alone cannot establish them.

The application runtime only loads bundled models. Documentation:
https://docs.swmansion.com/react-native-executorch/docs/0.8.x/typescript-api/natural-language-processing/SpeechToTextModule
