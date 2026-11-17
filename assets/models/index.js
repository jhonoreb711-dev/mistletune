// Bundled multilingual Whisper Tiny; ExecuTorch legacy model contract v0.10.0.
// Tokenizer contains JSON; .bin makes Metro bundle it as a file asset.
export const bundledWhisper = {
  modelName: 'whisper-tiny',
  isMultilingual: true,
  version: 'whisper-tiny-xnnpack-v0.10.0-v1',
  modelSource: require('./whisper-tiny.pte'),
  tokenizerSource: require('./whisper-tokenizer.bin'),
};
