// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');
const prettierPlugin = require('eslint-plugin-prettier');

module.exports = defineConfig([
  { ignores: ['dist/**', 'functions/**'] },
  expoConfig,
  {
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'error',
      // El logging debe pasar por el logger centralizado (utils/logger.ts),
      // que controla el entorno y el reporte a Sentry. El propio logger usa
      // console internamente (excepción abajo).
      'no-console': 'warn',
    },
  },
  {
    files: ['utils/logger.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  prettierConfig,
]);
