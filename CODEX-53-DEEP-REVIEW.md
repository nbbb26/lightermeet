# CODEX-53 Deep Review Round 2

Date: 2026-02-07  
Scope: full repository (`app/`, `lib/`, `styles/`, config), plus `pnpm test`, `pnpm lint`, `pnpm build`

## Findings (ordered by severity)

1. **High: E2EE passphrases and room IDs rely on non-cryptographic randomness.**
- Files: `lib/client-utils.ts:18`, `app/page.tsx:11`
- `randomString()` uses `Math.random()` for security-sensitive values (meeting passphrase default and room IDs).
- Impact: weaker unpredictability than required for encryption secrets and invite identifiers.
- Recommendation: use `crypto.getRandomValues` (browser) / `crypto.randomBytes` (server) with explicit entropy targets.

2. **High: Translation API allows cost amplification via unbounded/duplicate `targetLanguages`.**
- File: `app/api/translate/route.ts:80`
- `targetLanguages` is only filtered for valid entries; duplicates are not deduplicated and array size is not bounded before `translateForRoom()`.
- Impact: one request can trigger many redundant OpenAI calls, raising cost and latency.
- Recommendation: enforce max length (e.g., `<= SUPPORTED_LANGUAGES count`), dedupe with `Set`, reject duplicates/excess.

3. **High: Malformed URL hash can crash E2EE room entry path.**
- File: `lib/useSetupE2EE.ts:6`
- `decodePassphrase(location.hash.substring(1))` can throw `URIError` on invalid percent-encoding, with no guard.
- Impact: room page can fail to render if user opens a malformed E2EE link.
- Recommendation: wrap decode in `try/catch`, fall back to non-E2EE flow plus user-visible error.

4. **Medium: Translation cache key omits source language, causing correctness collisions.**
- File: `lib/translation.ts:100`
- Cache key is `text + targetLang`, so the same text translated from different source languages can return stale/wrong cached output.
- Impact: incorrect translations in multilingual rooms.
- Recommendation: include `sourceLanguage` (or detected source) in cache key.

5. **Medium: Chat translation formatter is O(n log n) per message render and scales poorly.**
- Files: `app/rooms/[roomName]/useTranslatedChat.tsx:160`, `app/rooms/[roomName]/useTranslatedChat.tsx:176`
- `messageFormatter` rebuilds/sorts the full translation index on each formatter call.
- Impact: large chat histories can degrade UI responsiveness.
- Recommendation: precompute index once per `translatedMessages` change (`useMemo`) and do O(1) lookup in formatter.

6. **Medium: Duplicate-message translation mapping is still fragile under reordering.**
- Files: `app/rooms/[roomName]/useTranslatedChat.tsx:181`, `app/rooms/[roomName]/useTranslatedChat.tsx:188`
- Mapping relies on per-render counters keyed only by raw text; list reorder/virtualization can attach wrong translation state to duplicates.
- Impact: users may see incorrect “translating/failed/translated” labels for repeated messages.
- Recommendation: bind formatter state to stable message identity from SDK message object instead of text position heuristics.

7. **Medium: Recording toggle can remain permanently disabled after successful API call without state transition.**
- Files: `lib/SettingsMenu.tsx:46`, `lib/SettingsMenu.tsx:59`
- `processingRecRequest` is reset only when `isRecording` changes. If backend returns 200 but recording state event is delayed/missed, button stays disabled.
- Impact: user gets stuck in recording UI until reload.
- Recommendation: reset in `finally`, add timeout/fallback polling, and surface explicit status feedback.

8. **Medium: Recording control requests interpolate unencoded room names in URL.**
- Files: `lib/SettingsMenu.tsx:67`, `lib/SettingsMenu.tsx:69`
- `room.name` is injected directly into query string; special characters can break request semantics.
- Impact: failed start/stop for valid room names containing reserved characters.
- Recommendation: use `encodeURIComponent(room.name)`.

9. **Medium: Datadog logger initialization can be repeated on room/log-level changes.**
- Files: `lib/Debug.tsx:24`, `lib/Debug.tsx:58`
- `datadogLogs.init()` is called inside an effect keyed by `[room, logLevel]`, which can run multiple times.
- Impact: duplicate init warnings, noisy logging behavior, potential perf overhead.
- Recommendation: guard init with one-time flag/module singleton.

10. **Low: Hook dependency issues still present and can create stale behavior.**
- Files: `lib/MicrophoneSettings.tsx:27`, `lib/RecordingIndicator.tsx:25`, `lib/usePerfomanceOptimiser.ts:55`
- `pnpm lint` reports missing effect dependencies.
- Impact: subtle stale closures and option changes not applied predictably.
- Recommendation: resolve warnings or explicitly document intentional invariants with stable refs.

11. **Low: Redundant language detection call in multi-translation path adds avoidable latency/cost.**
- File: `app/api/translate/route.ts:102`
- `translateForRoom()` already detects source language when missing, then route calls `detectLanguage(text)` again for response payload.
- Impact: extra OpenAI request per multi-translation call.
- Recommendation: return detected language from `translateForRoom()` or detect once in route and reuse.

12. **Low: Unused/dead UI path remains (`CustomVideoLayout` + imports/state not exercised).**
- Files: `app/components/CustomVideoLayout.tsx:35`, `app/components/CustomVideoLayout.tsx:146`, `app/components/CustomVideoLayout.tsx:14`
- `showChat` is never toggled, several imports/state are unused, and component is currently unreferenced by routes.
- Impact: maintenance drag and confusion about active UI architecture.
- Recommendation: remove dead path or wire/test it end-to-end.

## Open questions

1. Is `CustomVideoLayout` intentionally staged for future rollout, or should it be removed now?
2. Should recording controls remain query-based for compatibility, or can they migrate to `POST` with JSON body?

## Validation performed

- `pnpm test`: passed (`5/5`)
- `pnpm lint`: passed with 3 hook dependency warnings
- `pnpm build`: passed; source-map warning from `@mediapipe/tasks-vision` import chain remains
