// metro.config.js
const { getDefaultConfig } = require('@expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

// metro.config.js
module.exports = (() => {
  const config = getDefaultConfig(__dirname);

  // Añadimos 'cho' al listado de asset extensions
  config.resolver.assetExts.push('cho');

  // Interceptar jspdf y html2canvas para que resuelvan a nuestro mock y no rompan Expo
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === 'jspdf' || moduleName === 'html2canvas') {
      return {
        type: 'sourceFile',
        filePath: require('path').resolve(__dirname, 'mock-jspdf.js'),
      };
    }
    // Opcionalmente hacer que context maneje la lógica por defecto si no es jsPDF
    return context.resolveRequest(context, moduleName, platform);
  };

  return withUniwindConfig(config, {
    cssEntryFile: './global.css',
  });
})();
