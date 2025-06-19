module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [], // 'expo-router/babel' a veces se pone pero siempre nos dicen qeu lo quitemos
  };
};
// Este archivo es necesario para que Expo funcione correctamente con las rutas de la aplicación.