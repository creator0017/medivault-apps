module.exports = {
  preset: "jest-expo",
  setupFiles: ["<rootDir>/__tests__/setup.js"],
  testMatch: ["**/__tests__/**/*.test.js"],
  transformIgnorePatterns: [
    "node_modules/(?!(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|firebase|@firebase)",
  ],
  moduleNameMapper: {
    "^../firebaseConfig$": "<rootDir>/__mocks__/firebaseConfig.js",
    "^./firebaseConfig$": "<rootDir>/__mocks__/firebaseConfig.js",
    "^../../firebaseConfig$": "<rootDir>/__mocks__/firebaseConfig.js",
  },
  collectCoverageFrom: [
    "screens/**/*.js",
    "context/**/*.js",
    "!**/__tests__/**",
    "!**/node_modules/**",
  ],
};