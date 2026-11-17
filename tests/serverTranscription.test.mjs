import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';

const source = (await readFile(new URL('../components/serverTranscription.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\r?\n/gm, '').replaceAll('export ', '');

function fixture(version = 7, ready = true) {
  const uploads = [];
  const saved = [];
  const result = { timingVersion: 7, alignment: 'karaoke-captions', source: 'groq-whisper-large-v3', language: 'en', segments: [
    { start: 1.2, end: 2.3, text: 'Hello', words: [{ word: 'Hello', start: 1.2, end: 2.3 }] },
  ] };
  const FileSystem = {
    FileSystemUploadType: { MULTIPART: 1 },
    async uploadAsync(...args) { uploads.push(args); return { status: 200, body: JSON.stringify(result) }; },
  };
  const factory = new Function('Constants', 'FileSystem', 'writeGeneratedLyrics', 'lyricsCacheIdentity', 'fetch', `${source}; return transcribeViaServer;`);
  const transcribe = factory({ expoConfig: { hostUri: '127.0.0.1:8081' } }, FileSystem,
    async (...args) => { saved.push(args); }, async () => 'identity',
    async () => ({ ok: true, json: async () => ({ timingVersion: version, ready }) }));
  return { transcribe, uploads, saved };
}

test('outdated server is rejected before uploading or replacing saved lyrics', async () => {
  const { transcribe, uploads, saved } = fixture(1);
  await assert.rejects(transcribe({ id: 'song', source: 'file:///song.mp3' }, { libraryId: 'lib' }), /restart/i);
  assert.equal(uploads.length, 0);
  assert.equal(saved.length, 0);
});

test('concurrent lyric screens share one upload and save the alignment version', async () => {
  const { transcribe, uploads, saved } = fixture();
  const track = { id: 'song', source: 'file:///song.mp3' };
  const first = transcribe(track, { libraryId: 'lib' });
  const second = transcribe(track, { libraryId: 'lib' });
  assert.equal(first, second);
  await Promise.all([first, second]);
  assert.equal(uploads.length, 1);
  assert.equal(saved[0][1].timingVersion, 7);
  assert.equal(saved[0][1].alignment, 'karaoke-captions');
});

test('missing key prevents upload and explains configuration', async () => {
 const { transcribe, uploads } = fixture(7, false);
 await assert.rejects(transcribe({ id: 'song', source: 'file:///song.mp3' }), /connected.*Groq API key is missing/);
 assert.equal(uploads.length, 0);
});

test('explicit re-sync requests acoustic timestamps instead of estimated studio word timing', async () => {
  const { transcribe, uploads } = fixture();
  await transcribe({ id: 'song', source: 'file:///song.mp3' }, { libraryId: 'lib', force: true });
  assert.equal(uploads[0][2].parameters.timing, 'audio');
});
