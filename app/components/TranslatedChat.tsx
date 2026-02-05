'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Chat,
  useChat,
  useMaybeRoomContext,
  type ReceivedChatMessage,
  formatChatMessageLinks,
} from '@livekit/components-react';
import { SUPPORTED_LANGUAGES, LanguageCode } from '@/lib/translation';

interface TranslatedChatProps {
  userLanguage: LanguageCode;
  showOriginal?: boolean;
}

/**
 * TranslatedChat - A chat component with translation support
 * 
 * For now, uses the standard LiveKit Chat component.
 * Translation features can be added via a custom chat UI later.
 */
export function TranslatedChat({ 
  userLanguage, 
  showOriginal = true 
}: TranslatedChatProps) {
  // Basic message formatter that handles links
  const messageFormatter = useCallback((message: string) => {
    return formatChatMessageLinks(message);
  }, []);

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
