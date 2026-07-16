const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Root node_modules (monorepo hoisted packages)
const rootNodeModules = path.resolve(__dirname, '../../node_modules');
const localNodeModules = path.resolve(__dirname, 'node_modules');

// Watch both folders so Metro can resolve all packages
config.watchFolders = [__dirname, rootNodeModules];

// Resolve to the single hoisted root copies to avoid duplicate native view registration
config.resolver.extraNodeModules = {
  'react-native-safe-area-context': path.resolve(rootNodeModules, 'react-native-safe-area-context'),
  'react-native-screens':           path.resolve(rootNodeModules, 'react-native-screens'),
};

// Look in local first, then root
config.resolver.nodeModulesPaths = [localNodeModules, rootNodeModules];

module.exports = config;
