'use client';

import { useCallback } from 'react';
import { formatChatMessageLinks } from '@livekit/components-react';
import { LanguageCode } from '@/lib/translation';

/**
 * Hook to manage chat message translation
 * Returns a message formatter compatible with VideoConference
 * 
 * Note: Full translation support requires a custom chat UI.
 * This is a simplified version that just formats message links.
 */
export function useTranslatedChat(userLanguage: LanguageCode, showOriginal = true) {
  // MessageFormatter expects (message: string) => ReactNode
  const messageFormatter = useCallback((message: string) => {
    return formatChatMessageLinks(message);
  }, []);

  return messageFormatter;
}
