module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./jest.setup.ts'],
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.[tj]sx?$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|react-clone-referenced-element|@react-navigation|expo(nent)?|@expo|expo-.*|@expo(nent)?/.*|react-native-.*|@react-native-community|@react-navigation/.*)'
  ],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
};
