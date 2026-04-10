const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Exclude the Firebase Cloud Functions folder from the React Native bundle.
// functions/index.js uses Node-only modules (crypto, bcryptjs, pdf-lib)
// that cannot be bundled for React Native.
const functionsDir = path.resolve(__dirname, "functions");

// Build a regex that matches both Windows backslashes and forward slashes
const parts = functionsDir.split(path.sep);
const escapedParts = parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
const functionsBlockRegex = new RegExp(
  "^" + escapedParts.join("[\\\\/]") + "[\\\\/]"
);

config.resolver.blockList = [functionsBlockRegex];

module.exports = config;
