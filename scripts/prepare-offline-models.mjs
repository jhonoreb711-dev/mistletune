// Build-time setup only. This script is never imported by the mobile application.
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
const files = [
  {
    "source": "xnnpack/whisper_tiny_xnnpack.pte",
    "name": "whisper_tiny_xnnpack.pte",
    "sha256": "272cb572c2d54e2ef22bdb9e6d807e923bc8cd1827f43ff16d7dafcc62727762"
  },
  {
    "source": "tokenizer.json",
    "name": "whisper_tiny_tokenizer.bin",
    "sha256": "27fc476bfe7f17299480be2273fc0608e4d5a99aba2ab5dec5374b4482d1a566"
  }
];
const base = 'https://huggingface.co/software-mansion/react-native-executorch-whisper-tiny/resolve/v0.8.0/';
const directory = new URL('../assets/models/', import.meta.url);
await mkdir(directory, { recursive: true });
async function checksum(path) { const hash = createHash('sha256'); for await (const chunk of createReadStream(path)) hash.update(chunk); return hash.digest('hex'); }
for (const file of files) {
  const destination = new URL(file.name, directory);
  if (existsSync(destination) && await checksum(destination) === file.sha256) { console.log('Verified:', file.name); continue; }
  const temporary = new URL(file.name + '.part', directory);
  try {
    const response = await fetch(base + file.source, { signal: AbortSignal.timeout(300000) });
    if (!response.ok) throw new Error('Model download returned HTTP ' + response.status);
    await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary));
    if (await checksum(temporary) !== file.sha256) throw new Error('Model checksum did not match: ' + file.name);
    await rename(temporary, destination);
    console.log('Bundled:', file.name);
  } finally { await rm(temporary, { force: true }); }
}
