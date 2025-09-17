const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add resolver configuration to help with TurboModule issues
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Disable new architecture features that might be causing issues
config.transformer.enableTurboModules = false;

module.exports = config;
