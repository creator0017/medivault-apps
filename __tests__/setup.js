// Minimal setup for pure-logic Jest tests (no React Native native modules needed)
jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: "MaterialCommunityIcons",
}));
jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: "Images" },
}));
jest.mock("expo-document-picker", () => ({
  getDocumentAsync: jest.fn(),
}));
jest.mock("expo-file-system", () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: { Base64: "base64" },
}));

// Silence expected noise in test output
global.console = {
  ...console,
  error: jest.fn(),
  log: jest.fn(),
  warn: jest.fn(),
};
