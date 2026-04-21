/**
 * useSarvamTTS — Sarvam AI text-to-speech hook
 * Pipeline: English script → Sarvam translate → Sarvam TTS (spoken in selected language)
 *
 * Usage:
 *   const { speak, stop, speaking } = useSarvamTTS({ languageCode: "hi-IN", speaker: "anand" });
 *   speak("Your HbA1c is normal.");  // translated to Hindi, then spoken aloud
 */
import * as FileSystem from "expo-file-system/legacy";
import { useAudioPlayer } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";

const SARVAM_TTS_URL       = "https://api.sarvam.ai/text-to-speech";
const SARVAM_TRANSLATE_URL = "https://api.sarvam.ai/translate";

// Sarvam translate accepts up to 1000 chars; TTS accepts max 500 chars per input
const MAX_TRANSLATE_CHARS = 950;
const MAX_TTS_CHARS = 490;

/** Strip markdown symbols that TTS would read verbatim */
function stripMarkdown(text = "") {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[_~]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Clip text to `limit` chars at a sentence boundary */
function clipText(text, limit) {
  if (text.length <= limit) return text;
  const cut = text.lastIndexOf(".", limit);
  return (cut > 80 ? text.slice(0, cut + 1) : text.slice(0, limit)).trim();
}

/**
 * Translate English text → target language via Sarvam translate API.
 * Only sends the four fields Sarvam actually accepts on this endpoint.
 */
async function translateText(text, targetLanguageCode, apiKey) {
  if (targetLanguageCode === "en-IN") return text; // no-op for English

  try {
    const res = await fetch(SARVAM_TRANSLATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": apiKey,
      },
      body: JSON.stringify({
        input: text,
        source_language_code: "en-IN",
        target_language_code: targetLanguageCode,
        mode: "formal",
      }),
    });

    const data = await res.json();

    if (data?.translated_text) {
      return data.translated_text;
    }

    // Log the actual error so we can see what Sarvam returned
    console.warn("Sarvam translate: unexpected response →", JSON.stringify(data));
    return text; // fallback: speak English
  } catch (err) {
    console.warn("Sarvam translate: network error →", err);
    return text; // fallback: speak English
  }
}

export default function useSarvamTTS({
  languageCode = "en-IN",
  speaker = "tanya",
  pace = 1.0,
  cacheFile = "sarvam_tts.wav",
} = {}) {
  const [speaking, setSpeaking] = useState(false);
  const isMounted = useRef(true);
  const player = useAudioPlayer(null);
  const pollRef = useRef(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
      try { player.pause(); } catch (_) {}
    };
  }, []);

  const stop = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    try { player.pause(); } catch (_) {}
    if (isMounted.current) setSpeaking(false);
  }, [player]);

  const speak = useCallback(async (rawText, { silent = false } = {}) => {
    if (speaking) { stop(); return; }

    // Clip source text generously for translate, then clip translated result for TTS
    const cleaned = clipText(stripMarkdown(rawText), MAX_TRANSLATE_CHARS);
    if (!cleaned) return;

    const apiKey = process.env.EXPO_PUBLIC_SARVAM_API_KEY;
    if (!apiKey) {
      if (!silent) Alert.alert("Config error", "Sarvam API key missing.");
      return;
    }

    if (isMounted.current) setSpeaking(true);
    try {
      // Step 1 — Translate to the selected language
      const translated  = await translateText(cleaned, languageCode, apiKey);
      // Clip translated text to TTS limit (translated text can be longer than source)
      const textToSpeak = clipText(translated, MAX_TTS_CHARS);

      // Step 2 — Convert to speech
      const res = await fetch(SARVAM_TTS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-subscription-key": apiKey,
        },
        body: JSON.stringify({
          inputs: [textToSpeak],
          target_language_code: languageCode,
          speaker,
          pace,
          speech_sample_rate: 22050,
          enable_preprocessing: true,
          model: "bulbul:v3",
        }),
      });

      const data = await res.json();
      if (!data.audios?.[0]) throw new Error(JSON.stringify(data));

      const uri = FileSystem.cacheDirectory + cacheFile;
      await FileSystem.writeAsStringAsync(uri, data.audios[0], {
        encoding: FileSystem.EncodingType.Base64,
      });

      player.replace({ uri });
      player.play();

      // Poll until playback finishes
      pollRef.current = setInterval(() => {
        if (!player.playing) {
          clearInterval(pollRef.current);
          if (isMounted.current) setSpeaking(false);
        }
      }, 500);
    } catch (err) {
      console.error("useSarvamTTS error:", err);
      if (isMounted.current) setSpeaking(false);
      if (!silent) Alert.alert("Voice Unavailable", "Could not play voice. Please try again.");
    }
  }, [speaking, stop, languageCode, speaker, pace, cacheFile, player]);

  return { speak, stop, speaking };
}
