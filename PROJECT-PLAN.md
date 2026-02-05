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

### Phase 2: Chat Translation Hook
- [ ] Create custom Chat component that wraps LiveKit's
- [ ] Intercept outgoing messages
- [ ] Call translation API before broadcast
- [ ] Display original + translations in chat

### Phase 3: User Language Selection
- [ ] Add language selector in pre-join screen
- [ ] Store user's preferred language
- [ ] Translate incoming messages to user's language

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

## Future Features

- Voice-to-text with translation (subtitles)
- Local LLM option (Ollama)
- Translation memory/caching
- Language detection
