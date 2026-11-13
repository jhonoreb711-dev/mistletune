// Build-machine setup only. This script is never included in the mobile bundle.
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const directory = new URL('../assets/models/', import.meta.url);
const base = 'https://huggingface.co/software-mansion/react-native-executorch-whisper-tiny/resolve/v0.10.0/';
const files = [
  ['whisper-tiny.pte', `${base}xnnpack/whisper_tiny_xnnpack_fp32.pte`, 232609280, 'efad9b1c482dfe59e9496cb0fde5d46d5c1524973667469584a8ba156d35689c'],
  ['whisper-tokenizer.bin', `${base}tokenizer.json`, 2480466, '27fc476bfe7f17299480be2273fc0608e4d5a99aba2ab5dec5374b4482d1a566'],
];
async function digest(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(fileURLToPath(path))) hash.update(chunk);
  return hash.digest('hex');
}
await mkdir(directory, { recursive: true });
for (const [name, url, size, sha256] of files) {
  const destination = new URL(name, directory);
  const exists = await stat(destination).catch(() => null);
  if (!exists || exists.size !== size || await digest(destination) !== sha256) {
    const temporary = new URL(`${name}.part`, directory);
    try {
      console.log(`Downloading build asset: ${name}`);
      const response = await fetch(url, { signal: AbortSignal.timeout(600_000) });
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}: ${url}`);
      await pipeline(Readable.fromWeb(response.body), createWriteStream(fileURLToPath(temporary)));
      if ((await stat(temporary)).size !== size || await digest(temporary) !== sha256) throw new Error(`Incomplete or unexpected asset: ${name}`);
      if (name.endsWith('.bin')) JSON.parse(await readFile(temporary, 'utf8'));
      await rm(destination, { force: true });
      await rename(temporary, destination);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
  }
}
const tokenizer = JSON.parse(await readFile(new URL('whisper-tokenizer.bin', directory), 'utf8'));
if (!tokenizer.model?.vocab || !tokenizer.added_tokens?.length) throw new Error('Invalid Whisper tokenizer.');
await writeFile(new URL('index.js', directory), `// Bundled multilingual Whisper Tiny; ExecuTorch legacy model contract v0.10.0.
// Tokenizer contains JSON; .bin makes Metro bundle it as a file asset.
export const bundledWhisper = {
  modelName: 'whisper-tiny',
  isMultilingual: true,
  version: 'whisper-tiny-xnnpack-v0.10.0-v1',
  modelSource: require('./whisper-tiny.pte'),
  tokenizerSource: require('./whisper-tokenizer.bin'),
};
`);
console.log('Offline Whisper model and tokenizer ready in assets/models/. Rebuild the native app.');
