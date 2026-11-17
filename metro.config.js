const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const existingBlockList = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existingBlockList) ? existingBlockList : existingBlockList ? [existingBlockList] : []),
  /[/\\]server[/\\]\.(?:venv|cache)[/\\].*/,
];

config.transformer.babelTransformerPath = require.resolve(
  'react-native-svg-transformer'
);

config.resolver.assetExts = config.resolver.assetExts.filter(
  (ext) => ext !== 'svg'
);

config.resolver.sourceExts.push('svg');
config.resolver.assetExts = [...new Set([...config.resolver.assetExts, 'pte', 'bin', 'wasm'])];

module.exports = config;
