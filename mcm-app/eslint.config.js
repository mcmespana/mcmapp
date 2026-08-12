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
      // Techo de tamaño de archivo. Subido de 400 a 1000 el 2026-08-08: con
      // agentes de IA leyendo y editando el código, un archivo largo pero
      // coherente cuesta menos que la misma lógica repartida en seis ficheros
      // que hay que reconstruir mentalmente. Los gigantes que ya había se
      // quedan como están; el aviso ahora solo salta cuando un archivo se va
      // DE VERDAD de las manos. Sigue siendo 'warn', no 'error'.
      'max-lines': [
        'warn',
        { max: 1000, skipBlankLines: true, skipComments: true },
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
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        Buffer: 'readonly',
        process: 'readonly',
        require: 'readonly',
        module: 'writable',
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
  prettierConfig,
]);
