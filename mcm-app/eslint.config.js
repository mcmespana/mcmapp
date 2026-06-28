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
      // console internamente (excepción abajo). Migración completada (0
      // console.* en el código), así que ya bloquea como error.
      'no-console': 'error',
      // Señala archivos nuevos demasiado grandes SIN bloquear los legacy
      // (es 'warn', no 'error'). Ver docs/planes/PLAN_CALIDAD.md §0.1: cuando
      // la Fase 1 termine de trocear los gigantes, subir a 'error' con max 800.
      'max-lines': [
        'warn',
        { max: 400, skipBlankLines: true, skipComments: true },
      ],
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
