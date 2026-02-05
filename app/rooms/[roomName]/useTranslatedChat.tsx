'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { formatChatMessageLinks, useChat, useMaybeRoomContext } from '@livekit/components-react';
import { LanguageCode } from '@/lib/translation';
import type { ReceivedChatMessage } from '@livekit/components-react';

interface TranslatedMessage {
  originalMessage: ReceivedChatMessage;
  translatedText: string | null;
  translating: boolean;
  error: string | null;
}

/**
 * Hook to manage chat message translation
 * Listens to chat messages and translates them to the user's language
 * Returns both the messages and a formatter for display
 */
export function useTranslatedChat(userLanguage: LanguageCode, enabled = true) {
  const room = useMaybeRoomContext();
  const { chatMessages, send: sendMessage } = useChat();
  
  // Store translations by message timestamp
  const [translatedMessages, setTranslatedMessages] = useState<Map<number, TranslatedMessage>>(new Map());
  const abortControllersRef = useRef<Map<number, AbortController>>(new Map());
  const processedMessagesRef = useRef<Set<number>>(new Set());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllersRef.current.forEach(controller => controller.abort());
      abortControllersRef.current.clear();
    };
  }, []);

  // Clear translations when language changes
  useEffect(() => {
    setTranslatedMessages(new Map());
    processedMessagesRef.current.clear();
    abortControllersRef.current.forEach(controller => controller.abort());
    abortControllersRef.current.clear();
  }, [userLanguage]);

  // Process new chat messages
  useEffect(() => {
    if (!enabled || !room || chatMessages.length === 0) {
      return;
    }

    chatMessages.forEach(async (msg) => {
      const msgTimestamp = msg.timestamp;
      
      // Skip if already processed
      if (processedMessagesRef.current.has(msgTimestamp)) {
        return;
      }

      processedMessagesRef.current.add(msgTimestamp);

      // Don't translate own messages
      const localParticipant = room.localParticipant;
      const isOwnMessage = msg.from?.identity === localParticipant.identity;
      
      if (isOwnMessage) {
        setTranslatedMessages(prev => new Map(prev).set(msgTimestamp, {
          originalMessage: msg,
          translatedText: null,
          translating: false,
          error: null,
        }));
        return;
      }

      // Start translation
      const abortController = new AbortController();
      abortControllersRef.current.set(msgTimestamp, abortController);

      setTranslatedMessages(prev => new Map(prev).set(msgTimestamp, {
        originalMessage: msg,
        translatedText: null,
        translating: true,
        error: null,
      }));

      try {
        const response = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: msg.message,
            targetLanguage: userLanguage,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`Translation failed: ${response.statusText}`);
        }

        const data = await response.json();

        if (!abortController.signal.aborted) {
          setTranslatedMessages(prev => new Map(prev).set(msgTimestamp, {
            originalMessage: msg,
            translatedText: data.translatedText,
            translating: false,
            error: null,
          }));
          abortControllersRef.current.delete(msgTimestamp);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }

        console.error('Translation error:', error);

        if (!abortController.signal.aborted) {
          setTranslatedMessages(prev => new Map(prev).set(msgTimestamp, {
            originalMessage: msg,
            translatedText: null,
            translating: false,
            error: error instanceof Error ? error.message : 'Translation failed',
          }));
          abortControllersRef.current.delete(msgTimestamp);
        }
      }
    });
  }, [chatMessages, enabled, room, userLanguage]);

  // Message formatter for VideoConference component
  // This only formats the text, the actual translation display happens in the chat UI
  const messageFormatter = useCallback((message: string) => {
    // Find the translated message for this text
    let translatedMsg: TranslatedMessage | undefined;
    
    for (const [, msg] of translatedMessages) {
      if (msg.originalMessage.message === message) {
        translatedMsg = msg;
        break;
      }
    }

    // If no translation data, just format links
    if (!translatedMsg) {
      return formatChatMessageLinks(message);
    }

    // Own message - no translation
    if (!translatedMsg.translatedText && !translatedMsg.translating && !translatedMsg.error) {
      return formatChatMessageLinks(message);
    }

    // Translating
    if (translatedMsg.translating) {
      return (
        <>
          <div style={{ opacity: 0.7 }}>{formatChatMessageLinks(message)}</div>
          <div style={{
            fontSize: '0.85em',
            fontStyle: 'italic',
            opacity: 0.6,
            marginTop: '0.25rem',
          }}>
            Translating...
          </div>
        </>
      );
    }

    // Translation error
    if (translatedMsg.error) {
      return (
        <>
          {formatChatMessageLinks(message)}
          <div style={{
            fontSize: '0.85em',
            color: '#ff6b6b',
            marginTop: '0.25rem',
          }}>
            Translation failed
          </div>
        </>
      );
    }

    // Successfully translated
    if (translatedMsg.translatedText && translatedMsg.translatedText !== message) {
      return (
        <>
          <div style={{
            fontSize: '0.88em',
            fontStyle: 'italic',
            opacity: 0.5,
            marginBottom: '0.25rem',
            color: 'rgba(255, 255, 255, 0.5)',
          }}>
            {formatChatMessageLinks(message)}
          </div>
          <div>{formatChatMessageLinks(translatedMsg.translatedText)}</div>
        </>
      );
    }

    // No translation needed (message is already in target language)
    return formatChatMessageLinks(message);
  }, [translatedMessages]);

  return messageFormatter;
}
