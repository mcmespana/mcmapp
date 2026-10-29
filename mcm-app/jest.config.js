/** Proyecto principal: lógica y render de React Native bajo `jest-expo`. */
const native = {
  displayName: 'native',
  preset: 'jest-expo',
  // Reanimated arranca su módulo nativo (react-native-worklets) nada más
  // importarse, y bajo Jest eso revienta con `Cannot read properties of
  // undefined (reading 'loadUnpackers')`: no hay TurboModule que instalar.
  // Reanimated trae su propio resolver para tests (encadena el de
  // `react-native-worklets`): resuelve los ficheros NO `.native` de worklets y
  // de los módulos de Reanimated que lo necesitan. Sin esto, cualquier fichero
  // que acabe importando Reanimated —aunque sea de rebote, a través de un
  // contexto— tumba su suite entera. Con Reanimated 4.7 / worklets 0.13 el
  // resolver de worklets solo ya no basta (`runOnUISync is not supported on
  // web`): hay que usar el de Reanimated.
  resolver: './node_modules/react-native-reanimated/jest/resolver.js',
  // Mocks de módulos nativos para toda la suite: sin ellos, cualquier test que
  // monte una pantalla de verdad muere en el `import`. Ver `jest.setup.js`.
  // gesture-handler 3 necesita su propio setup (mockea el módulo nativo y el
  // detector de gestos): sin él, `GestureDetector` y `Swipeable` revientan al
  // montar cualquier pantalla con listas deslizables.
  setupFiles: [
    '<rootDir>/node_modules/react-native-gesture-handler/jestSetup.js',
    '<rootDir>/jest.setup.js',
  ],
  // `heroui-native` y `uniwind` se publican como ESM sin transpilar, así que
  // hay que pasarlos por Babel: sin esto, cualquier suite que renderice un
  // componente que use heroui (aunque sea de rebote, como el
  // `SegmentedControl` compartido) muere con «Unexpected token 'export'».
  // Salió al migrar la hoja de ajustes del lector a `SegmentedControl`
  // (2026-09-10) y es el mismo muro que se encontraría cualquier test de
  // render de los que pide `docs/desarrollo/COBERTURA.md`.
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|expo(nent)?|@expo(nent)?|expo-router|@expo-google-fonts/.*|react-clone-referenced-element|@react-navigation/.*|chordsheetjs|heroui-native|uniwind)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // chordsheetjs arrastra jspdf/html2canvas (ESM); Metro ya los mockea
    // en la app (metro.config.js) — aquí hacemos lo mismo.
    '^jspdf$': '<rootDir>/mock-jspdf.js',
    '^html2canvas$': '<rootDir>/mock-jspdf.js',
    '^firebase/app$': '<rootDir>/__mocks__/firebase.ts',
    '^firebase/database$': '<rootDir>/__mocks__/firebase.ts',
    // ESM sin transpilar, igual que los otros dos: sin esto, cualquier test
    // que monte `AuthProvider` muere con «Unexpected token 'export'».
    '^firebase/auth$': '<rootDir>/__mocks__/firebase-auth.ts',
    '^expo-network$': '<rootDir>/__mocks__/expo-network.ts',
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/__mocks__/@react-native-async-storage/async-storage.ts',
  },
  testMatch: ['**/__tests__/**/*.(test|spec).(ts|tsx|js|jsx)'],
  // Los `*.dom.test.*` corren en su propio proyecto (jsdom, sin React Native).
  testPathIgnorePatterns: ['/node_modules/', '\\.dom\\.test\\.'],
};

/**
 * Proyecto `dom`: tests que necesitan un DOM de verdad (jsdom) y NADA de React
 * Native. No pueden vivir en `native`: el setup de `@react-native/jest-preset`
 * redefine `window`, que en jsdom no es configurable (`Cannot redefine property:
 * window`). Se nombran `*.dom.test.ts`.
 */
const dom = {
  displayName: 'dom',
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.dom.test.(ts|tsx)'],
  transformIgnorePatterns: ['node_modules/(?!chordsheetjs)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // Igual que en `native`: chordsheetjs arrastra jspdf/html2canvas (ESM).
    '^jspdf$': '<rootDir>/mock-jspdf.js',
    '^html2canvas$': '<rootDir>/mock-jspdf.js',
  },
};

module.exports = {
  projects: [native, dom],
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
