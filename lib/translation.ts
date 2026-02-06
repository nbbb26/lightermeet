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

// Bounded LRU cache with TTL for translations
const MAX_CACHE_SIZE = 1000;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface CacheEntry {
  value: string;
  timestamp: number;
}

class LRUTranslationCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize: number, ttlMs: number) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(key: string): string | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used) by re-inserting
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: string): void {
    // Delete first if exists (to update position)
    this.cache.delete(key);

    // Evict oldest entries if at capacity
    while (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      } else {
        break;
      }
    }

    this.cache.set(key, { value, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

const translationCache = new LRUTranslationCache(MAX_CACHE_SIZE, CACHE_TTL_MS);

function getCacheKey(text: string, targetLang: string, sourceLang?: string): string {
  return `${sourceLang ?? 'auto'}::${text}::${targetLang}`;
}

/**
 * Translate text using GPT-5.2-nano (fast model) with retry logic
 */
export async function translateText(
  text: string,
  targetLanguage: LanguageCode,
  sourceLanguage?: LanguageCode,
  retryCount = 0
): Promise<TranslationResult> {
  const MAX_RETRIES = 2;
  
  // Skip translation if source and target are the same
  if (sourceLanguage === targetLanguage) {
    return { translatedText: text, detectedLanguage: sourceLanguage };
  }

  // Check cache first
  const cacheKey = getCacheKey(text, targetLanguage, sourceLanguage);
  const cached = translationCache.get(cacheKey);
  if (cached) {
    return { translatedText: cached, cached: true };
  }

  // Validate API key
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const targetLangName = SUPPORTED_LANGUAGES[targetLanguage];
  const sourceLangName = sourceLanguage ? SUPPORTED_LANGUAGES[sourceLanguage] : 'the original language';

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5-nano', // Fast, cheap model for translation
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

    const translatedText = response.choices[0]?.message?.content?.trim();
    
    if (!translatedText) {
      throw new Error('Empty response from translation API');
    }

    // Cache the result (key includes source language for correctness)
    translationCache.set(cacheKey, translatedText);

    return { translatedText };
  } catch (error) {
    // Retry on network errors or rate limits
    if (retryCount < MAX_RETRIES) {
      const isRetryable = error instanceof Error && (
        error.message.includes('rate limit') ||
        error.message.includes('timeout') ||
        error.message.includes('network')
      );
      
      if (isRetryable) {
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        return translateText(text, targetLanguage, sourceLanguage, retryCount + 1);
      }
    }
    
    // If all retries failed or non-retryable error, throw
    throw error;
  }
}

/**
 * Detect the language of a text
 */
export async function detectLanguage(text: string): Promise<LanguageCode | null> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.chat.completions.create({
    model: 'gpt-5-nano',
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
