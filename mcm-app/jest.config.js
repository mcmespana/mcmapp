module.exports = {
  preset: 'jest-expo',
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
};
