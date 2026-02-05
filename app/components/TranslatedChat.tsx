'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { 
  Chat,
  useChat,
  useMaybeRoomContext,
  ChatMessage,
  formatChatMessageLinks,
} from '@livekit/components-react';
import { SUPPORTED_LANGUAGES, LanguageCode } from '@/lib/translation';

interface TranslatedMessage extends ChatMessage {
  translations?: Record<LanguageCode, string>;
  isTranslating?: boolean;
}

interface TranslatedChatProps {
  userLanguage: LanguageCode;
  showOriginal?: boolean;
}

/**
 * TranslatedChat - A chat component that automatically translates messages
 * 
 * This wraps LiveKit's Chat component and adds:
 * 1. Automatic translation of outgoing messages
 * 2. Display of translations for incoming messages
 * 3. Language preference per user
 */
export function TranslatedChat({ 
  userLanguage, 
  showOriginal = true 
}: TranslatedChatProps) {
  const room = useMaybeRoomContext();
  const { chatMessages, send, isSending } = useChat();
  const [translatedMessages, setTranslatedMessages] = useState<Map<string, TranslatedMessage>>(new Map());
  const [pendingTranslations, setPendingTranslations] = useState<Set<string>>(new Set());

  // Translate incoming messages to user's language
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

  // Auto-translate new messages
  useEffect(() => {
    for (const message of chatMessages) {
      const messageId = `${message.timestamp}-${message.from?.identity}`;
      if (!translatedMessages.has(messageId) && !pendingTranslations.has(messageId)) {
        // Only translate if message is not from current user
        const isOwnMessage = message.from?.identity === room?.localParticipant.identity;
        if (!isOwnMessage) {
          translateMessage(message);
        }
      }
    }
  }, [chatMessages, translatedMessages, translateMessage, room, pendingTranslations]);

  // Custom message formatter that shows translations
  const messageFormatter = useCallback((message: ChatMessage) => {
    const messageId = `${message.timestamp}-${message.from?.identity}`;
    const translated = translatedMessages.get(messageId);
    const isOwnMessage = message.from?.identity === room?.localParticipant.identity;
    const isPending = pendingTranslations.has(messageId);

    // Format original message with links
    const formattedOriginal = formatChatMessageLinks(message);

    if (isOwnMessage) {
      return formattedOriginal;
    }

    if (isPending) {
      return (
        <div className="translated-message">
          <div className="original-text">{formattedOriginal}</div>
          <div className="translation-pending">Translating...</div>
        </div>
      );
    }

    if (translated?.translations?.[userLanguage]) {
      const translatedText = translated.translations[userLanguage];
      const isDifferent = translatedText !== message.message;

      return (
        <div className="translated-message">
          {showOriginal && isDifferent && (
            <div className="original-text text-gray-500 text-sm">{formattedOriginal}</div>
          )}
          <div className="translated-text">{translatedText}</div>
        </div>
      );
    }

    return formattedOriginal;
  }, [translatedMessages, pendingTranslations, userLanguage, showOriginal, room]);

  return (
    <Chat 
      messageFormatter={messageFormatter}
    />
  );
}

/**
 * LanguageSelector - Let users choose their preferred language
 */
export function LanguageSelector({
  value,
  onChange,
  className,
}: {
  value: LanguageCode;
  onChange: (lang: LanguageCode) => void;
  className?: string;
}) {
  return (
    <div className={`language-selector ${className || ''}`}>
      <label htmlFor="language-select" className="text-sm text-gray-400 mr-2">
        Your language:
      </label>
      <select
        id="language-select"
        value={value}
        onChange={(e) => onChange(e.target.value as LanguageCode)}
        className="bg-gray-800 text-white rounded px-2 py-1 text-sm border border-gray-600"
      >
        {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default TranslatedChat;
