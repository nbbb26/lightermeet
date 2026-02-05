import { NextRequest, NextResponse } from 'next/server';
import { translateText, detectLanguage, translateForRoom, LanguageCode, SUPPORTED_LANGUAGES } from '@/lib/translation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, targetLanguage, targetLanguages, sourceLanguage } = body;

    if (!text) {
      return NextResponse.json(
        { error: 'Missing required field: text' },
        { status: 400 }
      );
    }

    // Single translation
    if (targetLanguage) {
      if (!(targetLanguage in SUPPORTED_LANGUAGES)) {
        return NextResponse.json(
          { error: `Unsupported language: ${targetLanguage}` },
          { status: 400 }
        );
      }

      const result = await translateText(
        text,
        targetLanguage as LanguageCode,
        sourceLanguage as LanguageCode | undefined
      );

      return NextResponse.json({
        success: true,
        originalText: text,
        translatedText: result.translatedText,
        targetLanguage,
        sourceLanguage: sourceLanguage || result.detectedLanguage,
        cached: result.cached || false,
      });
    }

    // Multiple translations (for room broadcast)
    if (targetLanguages && Array.isArray(targetLanguages)) {
      const validLanguages = targetLanguages.filter(
        (lang): lang is LanguageCode => lang in SUPPORTED_LANGUAGES
      );

      if (validLanguages.length === 0) {
        return NextResponse.json(
          { error: 'No valid target languages provided' },
          { status: 400 }
        );
      }

      const translations = await translateForRoom(
        text,
        validLanguages,
        sourceLanguage as LanguageCode | undefined
      );

      return NextResponse.json({
        success: true,
        originalText: text,
        translations,
        sourceLanguage: sourceLanguage || await detectLanguage(text),
      });
    }

    return NextResponse.json(
      { error: 'Must provide either targetLanguage or targetLanguages' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json(
      { error: 'Translation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    supportedLanguages: SUPPORTED_LANGUAGES,
    usage: {
      singleTranslation: {
        method: 'POST',
        body: {
          text: 'Hello world',
          targetLanguage: 'es',
          sourceLanguage: 'en (optional)',
        },
      },
      multipleTranslations: {
        method: 'POST',
        body: {
          text: 'Hello world',
          targetLanguages: ['es', 'fr', 'de'],
          sourceLanguage: 'en (optional)',
        },
      },
    },
  });
}
