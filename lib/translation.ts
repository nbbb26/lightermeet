/**
 * Translation utilities for LiveKit Translate
 * Uses OpenAI GPT-5.2-nano for fast, cheap translations
 */

import OpenAI from 'openai';

// Supported languages with their codes
export const SUPPORTED_LANGUAGES = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  nl: 'Dutch',
  pl: 'Polish',
  ru: 'Russian',
  ar: 'Arabic',
  hi: 'Hindi',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  vi: 'Vietnamese',
  th: 'Thai',
  tr: 'Turkish',
} as const;

export type LanguageCode = keyof typeof SUPPORTED_LANGUAGES;

interface TranslationResult {
  translatedText: string;
  detectedLanguage?: LanguageCode;
  cached?: boolean;
}

// Simple in-memory cache for translations
const translationCache = new Map<string, string>();

function getCacheKey(text: string, targetLang: string): string {
  return `${text}::${targetLang}`;
}

/**
 * Translate text using GPT-5.2-nano (fast model)
 */
export async function translateText(
  text: string,
  targetLanguage: LanguageCode,
  sourceLanguage?: LanguageCode
): Promise<TranslationResult> {
  // Skip translation if source and target are the same
  if (sourceLanguage === targetLanguage) {
    return { translatedText: text, detectedLanguage: sourceLanguage };
  }

  // Check cache first
  const cacheKey = getCacheKey(text, targetLanguage);
  const cached = translationCache.get(cacheKey);
  if (cached) {
    return { translatedText: cached, cached: true };
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const targetLangName = SUPPORTED_LANGUAGES[targetLanguage];
  const sourceLangName = sourceLanguage ? SUPPORTED_LANGUAGES[sourceLanguage] : 'the original language';

  const response = await openai.chat.completions.create({
    model: 'gpt-5.2-nano', // Fast, cheap model for translation
    messages: [
      {
        role: 'system',
        content: `You are a translator. Translate the following text from ${sourceLangName} to ${targetLangName}. 
Only output the translation, nothing else. Preserve formatting, emojis, and tone.
If the text is already in the target language, return it unchanged.`,
      },
      {
        role: 'user',
        content: text,
      },
    ],
    max_tokens: 500,
    temperature: 0.1, // Low temperature for consistent translations
  });

  const translatedText = response.choices[0]?.message?.content?.trim() || text;

  // Cache the result
  translationCache.set(cacheKey, translatedText);

  return { translatedText };
}

/**
 * Detect the language of a text
 */
export async function detectLanguage(text: string): Promise<LanguageCode | null> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.chat.completions.create({
    model: 'gpt-5.2-nano',
    messages: [
      {
        role: 'system',
        content: `Detect the language of the following text. 
Respond with ONLY the 2-letter language code (e.g., "en", "es", "fr", "de", "zh", "ja").
If you can't detect it, respond with "en".`,
      },
      {
        role: 'user',
        content: text,
      },
    ],
    max_tokens: 5,
    temperature: 0,
  });

  const detectedCode = response.choices[0]?.message?.content?.trim().toLowerCase() as LanguageCode;
  
  if (detectedCode && detectedCode in SUPPORTED_LANGUAGES) {
    return detectedCode;
  }
  
  return 'en'; // Default to English
}

/**
 * Translate a message for multiple target languages at once
 * More efficient for broadcasting to a room
 */
export async function translateForRoom(
  text: string,
  targetLanguages: LanguageCode[],
  sourceLanguage?: LanguageCode
): Promise<Record<LanguageCode, string>> {
  const results: Record<string, string> = {};
  
  // Detect source language if not provided
  const sourceLang = sourceLanguage || await detectLanguage(text);
  results[sourceLang as string] = text; // Original text

  // Translate to each target language in parallel
  const translations = await Promise.all(
    targetLanguages
      .filter(lang => lang !== sourceLang)
      .map(async (lang) => {
        const result = await translateText(text, lang, sourceLang as LanguageCode);
        return { lang, text: result.translatedText };
      })
  );

  for (const { lang, text: translatedText } of translations) {
    results[lang] = translatedText;
  }

  return results as Record<LanguageCode, string>;
}

/**
 * Clear the translation cache
 */
export function clearTranslationCache(): void {
  translationCache.clear();
}
