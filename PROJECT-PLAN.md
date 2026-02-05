# LiveKit Translate - Project Plan

## Goal
Video conferencing app with automatic chat message translation using LLM.

## Stack
- **Base:** LiveKit Meet (Next.js + React + LiveKit Components)
- **Translation:** GPT-5.2-nano (fast, cheap) or local LLM
- **Hosting:** Self-hosted or Vercel

## Architecture

```
User A (English) → Chat Message → Translation API → Broadcast to all
                                      ↓
                    GPT-5.2-nano / Local LLM
                                      ↓
User B (Spanish) ← Translated Message (Spanish) ←
User C (German) ← Translated Message (German) ←
```

## Implementation Plan

### Phase 1: Setup & Basic Translation (Today)
- [x] Clone LiveKit Meet
- [ ] Create GitHub repo
- [ ] Set up environment (.env.local)
- [ ] Install dependencies (pnpm)
- [ ] Test base app works
- [ ] Add OpenAI SDK for translation

### Phase 2: Chat Translation Hook ✅ COMPLETED
- [x] Create custom Chat component that wraps LiveKit's
- [x] Create `useTranslatedChat` hook for message translation
- [x] Intercept incoming messages and translate them
- [x] Display original + translations in chat
- [x] Add loading state ("Translating...")

### Phase 3: User Language Selection ✅ COMPLETED
- [x] Add language selector in pre-join screen
- [x] Add language selector in room (top-right overlay)
- [x] Store user's preferred language in state
- [x] Translate incoming messages to user's language
- [x] Skip translating own messages

### Phase 4: Polish
- [ ] Loading states for translation
- [ ] Error handling
- [ ] Translation caching
- [ ] Rate limiting

## Key Files to Modify/Create

```
app/
├── api/
│   └── translate/
│       └── route.ts          # Translation API endpoint
├── components/
│   └── TranslatedChat.tsx    # Custom chat with translation
├── lib/
│   └── translation.ts        # Translation utility functions
└── rooms/[roomName]/
    └── PageClientImpl.tsx    # Add language selection
```

## Translation API Design

```typescript
// POST /api/translate
{
  "text": "Hello, how are you?",
  "targetLanguage": "es",
  "sourceLanguage": "en"  // optional, auto-detect
}

// Response
{
  "translatedText": "Hola, ¿cómo estás?",
  "detectedLanguage": "en"
}
```

## Environment Variables

```env
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
NEXT_PUBLIC_LIVEKIT_URL=
OPENAI_API_KEY=  # For GPT-5.2-nano translation
```

## MVP Features

1. ✅ Video conferencing (from LiveKit Meet)
2. 🔄 Chat with auto-translation
3. 🔄 Language selection per user
4. 🔄 Original + translated text display

## Implementation Details

### Integration Approach
We integrated translation into the existing LiveKit VideoConference component using a custom message formatter:

1. **Custom Hook (`useTranslatedChat`)**: 
   - Manages translation state for all chat messages
   - Automatically translates incoming messages to user's preferred language
   - Skips translating messages sent by the current user
   - Shows "Translating..." while waiting for API response
   - Caches translations to avoid re-translating

2. **Language Selection**:
   - Added `LanguageSelector` component in two places:
     - Pre-join screen: Set language before entering room
     - In-room overlay (top-right): Change language during call
   - Language state managed at PageClientImpl level and passed down

3. **Chat Display**:
   - Original message shown in gray italic text (if different from translation)
   - Translated message shown prominently
   - Own messages not translated (shown as-is)

### Files Modified
- `app/rooms/[roomName]/PageClientImpl.tsx` - Added language state and selector
- `app/rooms/[roomName]/useTranslatedChat.tsx` - New hook for translation logic

### Files Created for Translation (Already Existed)
- `app/components/TranslatedChat.tsx` - Standalone translated chat component
- `app/api/translate/route.ts` - Translation API endpoint
- `lib/translation.ts` - Translation utilities using OpenAI

## Testing Checklist

- [ ] Join room with different language selected
- [ ] Send messages and verify they appear untranslated for sender
- [ ] Have second user join with different language
- [ ] Verify messages are translated for each user
- [ ] Change language mid-call and verify new translations appear
- [ ] Test with special characters, emojis, URLs
- [ ] Test with messages already in target language (should skip translation)
- [ ] Verify translation caching works (no duplicate API calls)

## Future Features

- Voice-to-text with translation (subtitles)
- Local LLM option (Ollama)
- Better translation memory/caching (persistent)
- Automatic language detection
- Translate outgoing messages for broadcast (multi-language rooms)
