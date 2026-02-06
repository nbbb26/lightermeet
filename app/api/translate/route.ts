import { NextRequest, NextResponse } from 'next/server';
import { translateText, detectLanguage, translateForRoom, LanguageCode, SUPPORTED_LANGUAGES } from '@/lib/translation';
import {
  verifyParticipantToken,
  unauthorizedResponse,
  checkRateLimit,
  getClientIP,
  rateLimitedResponse,
} from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    // Auth: require valid LiveKit participant token
    const auth = await verifyParticipantToken(request);
    if (!auth) {
      return unauthorizedResponse('Valid participant token required for translation');
    }

    // Rate limit: 30 requests per minute per identity (translation is chatty)
    if (!checkRateLimit(`translate:${auth.identity}`, 30, 60_000)) {
      return rateLimitedResponse();
    }

    // Additional IP-based rate limit: 100 requests per minute
    const clientIP = getClientIP(request);
    if (!checkRateLimit(`translate-ip:${clientIP}`, 100, 60_000)) {
      return rateLimitedResponse();
    }

    const body = await request.json();
    const { text, targetLanguage, targetLanguages, sourceLanguage } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid required field: text' },
        { status: 400 }
      );
    }

    if (text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Text cannot be empty' },
        { status: 400 }
      );
    }

    if (text.length > 5000) {
      return NextResponse.json(
        { error: 'Text exceeds maximum length of 5000 characters' },
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
    // Issue #10: Don't expose internal error details to client
    return NextResponse.json(
      { error: 'Translation failed' },
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
        headers: { Authorization: 'Bearer <livekit-participant-token>' },
        body: {
          text: 'Hello world',
          targetLanguage: 'es',
          sourceLanguage: 'en (optional)',
        },
      },
      multipleTranslations: {
        method: 'POST',
        headers: { Authorization: 'Bearer <livekit-participant-token>' },
        body: {
          text: 'Hello world',
          targetLanguages: ['es', 'fr', 'de'],
          sourceLanguage: 'en (optional)',
        },
      },
    },
  });
}
