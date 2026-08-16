module.exports = {
  preset: 'jest-expo',
  // Reanimated arranca su módulo nativo (react-native-worklets) nada más
  // importarse, y bajo Jest eso revienta con `Cannot read properties of
  // undefined (reading 'loadUnpackers')`: no hay TurboModule que instalar.
  // `react-native-worklets` trae su propio resolver para tests, que hace que se
  // resuelvan los ficheros NO `.native` de la librería. Sin esto, cualquier
  // fichero que acabe importando Reanimated —aunque sea de rebote, a través de
  // un contexto— tumba su suite entera.
  resolver: './node_modules/react-native-worklets/jest/resolver.js',
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|expo(nent)?|@expo(nent)?|expo-router|@expo-google-fonts/.*|react-clone-referenced-element|@react-navigation/.*|chordsheetjs)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // chordsheetjs arrastra jspdf/html2canvas (ESM); Metro ya los mockea
    // en la app (metro.config.js) — aquí hacemos lo mismo.
    '^jspdf$': '<rootDir>/mock-jspdf.js',
    '^html2canvas$': '<rootDir>/mock-jspdf.js',
    '^firebase/app$': '<rootDir>/__mocks__/firebase.ts',
    '^firebase/database$': '<rootDir>/__mocks__/firebase.ts',
    '^expo-network$': '<rootDir>/__mocks__/expo-network.ts',
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/__mocks__/@react-native-async-storage/async-storage.ts',
  },
  testMatch: ['**/__tests__/**/*.(test|spec).(ts|tsx|js|jsx)'],
  /**
   * Qué cuenta para la cobertura (`npm run test:coverage`).
   *
   * Solo la lógica: `utils/`, `hooks/`, `services/`, `contexts/` y
   * `constants/`. Las pantallas (`app/`) y los componentes (`components/`) NO
   * entran a propósito: testear render de UI es caro y frágil, y el objetivo
   * aquí es blindar reglas que se pueden romper sin enterarse (ver
   * `docs/desarrollo/COBERTURA.md`).
   */
  collectCoverageFrom: [
    'utils/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'services/**/*.{ts,tsx}',
    'contexts/**/*.{ts,tsx}',
    'constants/**/*.{ts,tsx}',
    // El Wordle está desactivado en la app y se conserva solo como referencia
    // (ver CLAUDE.md): no se toca, así que tampoco cuenta para la cobertura.
    '!hooks/useWordle*.{ts,tsx}',
  ],
};
