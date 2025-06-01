module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['expo-router/babel'], // Asegúrate de que esta línea esté presente
  };
};
// Este archivo es necesario para que Expo funcione correctamente con las rutas de la aplicación.