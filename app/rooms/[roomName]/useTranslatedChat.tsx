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
 * Generate a stable composite key for a chat message.
 * Uses identity + timestamp + text hash to handle duplicates.
 */
function getMessageKey(msg: ReceivedChatMessage): string {
  const identity = msg.from?.identity ?? 'unknown';
  // Simple hash of message text for uniqueness
  let hash = 0;
  const text = msg.message ?? '';
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `${identity}:${msg.timestamp}:${hash}`;
}

/**
 * Hook to manage chat message translation
 * Listens to chat messages and translates them to the user's language
 * Returns both the messages and a formatter for display
 */
export function useTranslatedChat(userLanguage: LanguageCode, enabled = true, participantToken?: string) {
  const room = useMaybeRoomContext();
  const { chatMessages, send: sendMessage } = useChat();
  
  // Store translations by composite key (identity + timestamp + text hash)
  const [translatedMessages, setTranslatedMessages] = useState<Map<string, TranslatedMessage>>(new Map());
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const processedMessagesRef = useRef<Set<string>>(new Set());

  // Cleanup on unmount
  useEffect(() => {
    const controllers = abortControllersRef.current;
    return () => {
      controllers.forEach(controller => controller.abort());
      controllers.clear();
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
      const msgKey = getMessageKey(msg);
      
      // Skip if already processed
      if (processedMessagesRef.current.has(msgKey)) {
        return;
      }

      processedMessagesRef.current.add(msgKey);

      // Don't translate own messages
      const localParticipant = room.localParticipant;
      const isOwnMessage = msg.from?.identity === localParticipant.identity;
      
      if (isOwnMessage) {
        setTranslatedMessages(prev => new Map(prev).set(msgKey, {
          originalMessage: msg,
          translatedText: null,
          translating: false,
          error: null,
        }));
        return;
      }

      // Start translation
      const abortController = new AbortController();
      abortControllersRef.current.set(msgKey, abortController);

      setTranslatedMessages(prev => new Map(prev).set(msgKey, {
        originalMessage: msg,
        translatedText: null,
        translating: true,
        error: null,
      }));

      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (participantToken) {
          headers['Authorization'] = `Bearer ${participantToken}`;
        }

        const response = await fetch('/api/translate', {
          method: 'POST',
          headers,
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
          setTranslatedMessages(prev => new Map(prev).set(msgKey, {
            originalMessage: msg,
            translatedText: data.translatedText,
            translating: false,
            error: null,
          }));
          abortControllersRef.current.delete(msgKey);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }

        console.error('Translation error:', error);

        if (!abortController.signal.aborted) {
          setTranslatedMessages(prev => new Map(prev).set(msgKey, {
            originalMessage: msg,
            translatedText: null,
            translating: false,
            error: error instanceof Error ? error.message : 'Translation failed',
          }));
          abortControllersRef.current.delete(msgKey);
        }
      }
    });
  }, [chatMessages, enabled, room, userLanguage, participantToken]);

  // Build a reverse index: message text -> list of TranslatedMessage entries (ordered by timestamp)
  // This handles duplicate messages correctly by consuming matches in order
  const textToTranslations = useCallback(() => {
    const index = new Map<string, TranslatedMessage[]>();
    // Sort entries by timestamp to maintain consistent ordering
    const entries = Array.from(translatedMessages.values()).sort(
      (a, b) => a.originalMessage.timestamp - b.originalMessage.timestamp
    );
    for (const entry of entries) {
      const text = entry.originalMessage.message ?? '';
      const list = index.get(text) ?? [];
      list.push(entry);
      index.set(text, list);
    }
    return index;
  }, [translatedMessages]);

  // Track render position for duplicate messages within a single render cycle
  const renderCounterRef = useRef<Map<string, number>>(new Map());

  // Message formatter for VideoConference component
  const messageFormatter = useCallback((message: string) => {
    const index = textToTranslations();
    const matches = index.get(message);
    
    // Get the next unrendered match for this text (handles duplicates)
    const renderCount = renderCounterRef.current.get(message) ?? 0;
    const translatedMsg = matches?.[renderCount];
    // Advance counter for next call with same text
    renderCounterRef.current.set(message, renderCount + 1);
    // Reset counters when we've gone through all matches (next render cycle)
    if (renderCount + 1 >= (matches?.length ?? 0)) {
      // Schedule reset for next microtask (after this render cycle)
      queueMicrotask(() => renderCounterRef.current.delete(message));
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
  }, [textToTranslations]);

  return messageFormatter;
}
