# Mobile UI Redesign — Discussion with Codex 5.3

## Date: 2026-02-07

---

## Decision 1: Architecture Approach

**Question:** Should we override via CSS (keeping VideoConference prefab), replace with custom composition, or wrap with overlays?

**Codex 5.3 Recommendation:** **Option B for mobile only** — custom composition on mobile, keep the VideoConference prefab on desktop.

**Reasoning:**
- `VideoConference` is a monolithic prefab with internal state management for chat visibility and toolbar
- CSS-only overrides would be brittle against LiveKit DOM/class changes
- Wrapper + overlay fights internal prefab state
- Custom composition gives full control over fullscreen, toolbar visibility, and chat UX
- Desktop path stays untouched = zero risk for existing users

**Decision:** Implement `MobileVideoConference` component that uses lower-level LiveKit components (`GridLayout`, `FocusLayout`, `ParticipantTile`, `TrackToggle`, `DisconnectButton`, `useChat`, `useTracks`). Desktop continues using `VideoConference` prefab unchanged.

---

## Decision 2: Component Architecture & State Management

**Question:** What should the component tree and state management look like?

**Codex 5.3 Recommendation:**

```
MobileVideoConference
├── VideoLayer (full viewport)
│   ├── MainComposition (grid or focus layout based on focused track)
│   └── ImmersiveFullscreenOverlay (position:fixed, z-index:9999)
├── ChatLayer
│   ├── CollapsedChatToasts (toast messages, auto-fade 3-5s)
│   └── ExpandedChatOverlay (glassmorphism panel, scrollable)
└── BottomToolbar (auto-hiding, toggleable)
    ├── TrackToggle (mic)
    ├── TrackToggle (camera)
    ├── ChatToggle
    └── DisconnectButton
```

**State:** `useReducer` with actions for INTERACTION, SET_FOCUS, ENTER/EXIT_FULLSCREEN, TOGGLE_TOOLBAR, SET_CHAT_MODE, ENQUEUE/EXPIRE_TOAST.

**Decision:** Accepted as-is. Implementation will follow this structure.

---

## Decision 3: Fullscreen Exit Mechanism

**Codex 5.3 Recommendation:**
- Tap anywhere on the fullscreen overlay to show/hide toolbar controls
- Explicit close button (X) in top-right corner
- Swipe down gesture (deltaY > 80px threshold)

**Decision:** Implement tap-to-toggle-controls + close button. Skip swipe gesture for v1 to keep scope manageable.

---

## Decision 4: Mobile Detection

**Options:** Media query in CSS vs `window.matchMedia` in JS vs user-agent detection.

**Decision:** Use `window.matchMedia('(max-width: 600px)')` with a `useIsMobile()` hook. This matches our existing CSS breakpoint at 600px and allows React to conditionally render the right component tree.
