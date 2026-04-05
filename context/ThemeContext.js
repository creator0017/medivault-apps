import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);

export const LIGHT = {
  bg: "#F8FAFC",
  card: "#FFFFFF",
  text: "#1E293B",
  subText: "#64748B",
  muted: "#94A3B8",
  border: "#F1F5F9",
  inputBg: "#F1F5F9",
  navBg: "#FFFFFF",
  accent: "#2E75B6",
};

export const DARK = {
  bg: "#0F172A",
  card: "#1E293B",
  text: "#F1F5F9",
  subText: "#94A3B8",
  muted: "#64748B",
  border: "#334155",
  inputBg: "#1E293B",
  navBg: "#0F172A",
  accent: "#60A5FA",
};

const FONT_MULT = { small: 0.88, normal: 1, large: 1.15 };

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false);
  const [fontScale, setFontScale] = useState("normal");

  useEffect(() => {
    AsyncStorage.multiGet(["mv_dark", "mv_font"]).then(
      ([[, dark], [, font]]) => {
        if (dark === "true") setIsDark(true);
        if (font) setFontScale(font);
      }
    );
  }, []);

  const toggleDark = async () => {
    const next = !isDark;
    setIsDark(next);
    await AsyncStorage.setItem("mv_dark", String(next));
  };

  const changeFontScale = async (scale) => {
    setFontScale(scale);
    await AsyncStorage.setItem("mv_font", scale);
  };

  const theme = isDark ? DARK : LIGHT;
  const fm = FONT_MULT[fontScale] || 1;

  return (
    <ThemeContext.Provider
      value={{ isDark, toggleDark, theme, fontScale, changeFontScale, fm }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
