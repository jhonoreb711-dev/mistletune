const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
<<<<<<< HEAD
const existingBlockList = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existingBlockList) ? existingBlockList : existingBlockList ? [existingBlockList] : []),
  /[/\\]server[/\\]\.(?:venv|cache)[/\\].*/,
];
=======
>>>>>>> 2376395559270ab40f72453a5475d22bec935705

config.transformer.babelTransformerPath = require.resolve(
  'react-native-svg-transformer'
);

config.resolver.assetExts = config.resolver.assetExts.filter(
  (ext) => ext !== 'svg'
);

config.resolver.sourceExts.push('svg');
<<<<<<< HEAD
config.resolver.assetExts = [...new Set([...config.resolver.assetExts, 'pte', 'bin', 'wasm'])];
=======
config.resolver.assetExts = [...new Set([...config.resolver.assetExts, 'pte', 'bin'])];
>>>>>>> 2376395559270ab40f72453a5475d22bec935705

module.exports = config;
