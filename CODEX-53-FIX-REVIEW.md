# CODEX-53 Fix Review

Date: 2026-02-07  
Scope: `HEAD~1..HEAD` (`07117f7`)

## Findings (most severe first)

1. **High: Recording is broken on the `/custom` flow (regression introduced by this fix).**
- `lib/SettingsMenu.tsx:26` now expects an auth token from `useAuthToken()` and only sends `Authorization` when context exists (`lib/SettingsMenu.tsx:61`, `lib/SettingsMenu.tsx:67`, `lib/SettingsMenu.tsx:69`).
- `app/rooms/[roomName]/PageClientImpl.tsx:317` wraps with `AuthTokenProvider`, but `app/custom/VideoConferenceClientImpl.tsx:101` does not.
- Result: recording start/stop calls from `/custom` now hit authenticated endpoints without bearer token and fail with `401`.
- Verdict: **fix is not complete; this introduces a functional regression.**

2. **High: Translation mapping fix is incomplete; duplicate message text can still render wrong translation state.**
- The hook now stores translations by composite key (`app/rooms/[roomName]/useTranslatedChat.tsx:19`, `app/rooms/[roomName]/useTranslatedChat.tsx:42`), which is good.
- But formatter lookup still matches by raw message text (`app/rooms/[roomName]/useTranslatedChat.tsx:157`, `app/rooms/[roomName]/useTranslatedChat.tsx:162`).
- If two different messages have identical text, UI can show the wrong translated/error/translating state.
- Verdict: **the prior issue is only partially fixed.**

3. **Medium: Auth hardening is still bypassable for tokens without room grants.**
- `verifyParticipantToken` accepts any token with `sub` and returns optional `roomName` (`lib/api-auth.ts:37`, `lib/api-auth.ts:42`).
- Recording endpoints only reject mismatched room when `auth.roomName` exists (`app/api/record/start/route.ts:31`, `app/api/record/stop/route.ts:30`).
- So a valid token signed by your API secret but lacking `video.room` is treated as authorized for arbitrary `roomName`.
- Verdict: **security fix is incomplete** (room-scoped authorization should be mandatory for these routes).

4. **Medium: E2EE/connect lifecycle can race when room instance changes.**
- Room is recreated from `roomOptions` (`app/rooms/[roomName]/PageClientImpl.tsx:217`, `app/custom/VideoConferenceClientImpl.tsx:53`).
- `e2eeSetupComplete` is not reset to `false` when room changes (`app/rooms/[roomName]/PageClientImpl.tsx:167`, `app/custom/VideoConferenceClientImpl.tsx:31`).
- Connect effect gates on `e2eeSetupComplete` and may connect a new room before key setup completes (`app/rooms/[roomName]/PageClientImpl.tsx:253`, `app/custom/VideoConferenceClientImpl.tsx:75`).
- Verdict: **potential race/ordering bug remains** under option changes.

5. **Low: dead/unfinished code in recording start route.**
- `getClientIP` is imported but unused (`app/api/record/start/route.ts:7`).
- Suggests IP-limit hardening was intended but not implemented.
- Verdict: minor quality issue.

## What looks correct

- Recording/translation routes now require bearer token auth and apply basic rate limiting.
- Sensitive error details are no longer returned from `/api/translate`.
- Build and tests pass on current tree (`npm run build`, `npm run test`), and lint shows only pre-existing warnings.

## Validation run

- `npm run lint`: pass with warnings (no new lint failures from these changes).
- `npm run test`: pass (`1` file, `5` tests).
- `npm run build`: pass.

## Bottom line

These fixes are **partially correct** but **not complete**, and they introduce at least one clear regression (`/custom` recording). I would not mark CODEX-53 as fully closed until the high-severity items above are addressed.
