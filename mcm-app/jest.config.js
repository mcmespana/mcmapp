module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|expo(nent)?|@expo(nent)?|expo-router|@expo-google-fonts/.*|react-clone-referenced-element|@react-navigation/.*)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^firebase/app$': '<rootDir>/__mocks__/firebase.ts',
    '^firebase/database$': '<rootDir>/__mocks__/firebase.ts',
    '^expo-network$': '<rootDir>/__mocks__/expo-network.ts',
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/__mocks__/@react-native-async-storage/async-storage.ts',
  },
  testMatch: ['**/__tests__/**/*.(test|spec).(ts|tsx|js|jsx)'],
};
