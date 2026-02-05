'use client';

import { useState, useCallback, useEffect } from 'react';
import { ChatMessage, formatChatMessageLinks, useMaybeRoomContext } from '@livekit/components-react';
import { LanguageCode } from '@/lib/translation';

interface TranslatedMessage extends ChatMessage {
  translations?: Record<LanguageCode, string>;
  isTranslating?: boolean;
}

/**
 * Hook to manage chat message translation
 * Returns a custom message formatter that displays translations
 */
export function useTranslatedChat(userLanguage: LanguageCode, showOriginal = true) {
  const room = useMaybeRoomContext();
  const [translatedMessages, setTranslatedMessages] = useState<Map<string, TranslatedMessage>>(new Map());
  const [pendingTranslations, setPendingTranslations] = useState<Set<string>>(new Set());

  // Translate a message to user's language
  const translateMessage = useCallback(async (message: ChatMessage) => {
    const messageId = `${message.timestamp}-${message.from?.identity}`;
    
    if (pendingTranslations.has(messageId)) return;
    
    setPendingTranslations(prev => new Set(prev).add(messageId));

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: message.message,
          targetLanguage: userLanguage,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTranslatedMessages(prev => {
          const updated = new Map(prev);
          updated.set(messageId, {
            ...message,
            translations: {
              [userLanguage]: data.translatedText,
            },
          });
          return updated;
        });
      }
    } catch (error) {
      console.error('Translation failed:', error);
    } finally {
      setPendingTranslations(prev => {
        const updated = new Set(prev);
        updated.delete(messageId);
        return updated;
      });
    }
  }, [userLanguage, pendingTranslations]);

  // Custom message formatter that shows translations
  const messageFormatter = useCallback((message: ChatMessage) => {
    const messageId = `${message.timestamp}-${message.from?.identity}`;
    const translated = translatedMessages.get(messageId);
    const isOwnMessage = message.from?.identity === room?.localParticipant.identity;
    const isPending = pendingTranslations.has(messageId);

    // Format original message with links
    const formattedOriginal = formatChatMessageLinks(message);

    // Don't translate own messages
    if (isOwnMessage) {
      return formattedOriginal;
    }

    // Trigger translation if not already done
    if (!translated && !isPending) {
      translateMessage(message);
    }

    if (isPending) {
      return (
        <div className="translated-message">
          <div className="original-text">{formattedOriginal}</div>
          <div className="translation-pending text-gray-400 text-xs italic">Translating...</div>
        </div>
      );
    }

    if (translated?.translations?.[userLanguage]) {
      const translatedText = translated.translations[userLanguage];
      const isDifferent = translatedText !== message.message;

      return (
        <div className="translated-message">
          {showOriginal && isDifferent && (
            <div className="original-text text-gray-500 text-sm italic">{formattedOriginal}</div>
          )}
          <div className="translated-text">{translatedText}</div>
        </div>
      );
    }

    return formattedOriginal;
  }, [translatedMessages, pendingTranslations, userLanguage, showOriginal, room, translateMessage]);

  return messageFormatter;
}
