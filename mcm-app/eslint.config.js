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
    // Reglas del React Compiler que eslint-config-expo activa como ERROR a
    // partir del SDK 56. Sacan ~330 avisos sobre patrones que ya estaban en el
    // código desde mucho antes (refs leídas en render, `sharedValue.value = …`
    // de Reanimated, setState dentro de efectos). Saneárlos es un trabajo
    // aparte —está apuntado en TODO.md / docs/planes/BACKLOG.md—, así que
    // aquí quedan como 'warn': se ven, pero no bloquean el lint.
    rules: {
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
  {
    files: ['utils/logger.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Scripts de build y tests corren en Node, fuera del bundle de la app: ahí
    // console es la salida legítima (y algún test espía sobre console).
    files: ['scripts/**', '__tests__/**'],
    rules: {
      'no-console': 'off',
    },
  },
  prettierConfig,
]);
