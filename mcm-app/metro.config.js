// metro.config.js
const { getDefaultConfig } = require('@expo/metro-config');

module.exports = (() => {
  const config = getDefaultConfig(__dirname);

  // Añadimos 'cho' al listado de asset extensions
  config.resolver.assetExts.push('cho');

  return config;
})();
