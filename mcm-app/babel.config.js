module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [], // Elimina 'expo-router/babel'
  };
};
// Este archivo es necesario para que Expo funcione correctamente con las rutas de la aplicación.