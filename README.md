<<<<<<< HEAD
# MistleTunes

A local music player built with Expo and React Native, with word-synchronized lyrics.

## Start the app

```bash
npm install
npx expo start
```

## Local Voxtral lyrics

The local Python service uses Voxtral Mini 4B Realtime to transcribe songs and
a CTC aligner to return word timestamps. Audio stays on the computer running
the service; the phone and computer must share Wi-Fi when using a physical phone.

1. Run `server/setup-voxtral.bat` once to install the Windows CPU runtime and
   download the Voxtral and word-alignment weights to your local model cache.
2. Run `server/start-server.bat`.
3. Keep the server window open while importing or
   generating lyrics.
4. Start or reload the Expo app and import a music folder. Older generated
   lyrics are refreshed with Voxtral when opened.

The first download is about 3 GB, and CPU transcription can take a while.
Lyrics are saved after generation, so playback does not run the models again.
Tagalog is not among Voxtral Realtime's listed languages and may not transcribe
reliably. See [the lyrics timing guide](docs/lyric-timing.md) for details.

## Checks

```bash
npm run lint
npm run test:lyrics
```
=======
# My New Project 
>>>>>>> 2376395559270ab40f72453a5475d22bec935705
