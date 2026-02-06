'use client';

import React, { useReducer, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  useTracks,
  useChat,
  useRoomContext,
  useLocalParticipant,
  GridLayout,
  ParticipantTile,
  TrackToggle,
  DisconnectButton,
  RoomAudioRenderer,
  ConnectionStateToast,
  StartAudio,
  formatChatMessageLinks,
  LayoutContextProvider,
  isTrackReference,
} from '@livekit/components-react';
import type {
  TrackReferenceOrPlaceholder,
  ReceivedChatMessage,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { LanguageCode } from '@/lib/translation';
import { LanguageSelector } from '@/app/components/TranslatedChat';

// ========== Types ==========

type ChatMode = 'collapsed' | 'expanded';

interface ToastMessage {
  id: string;
  message: ReceivedChatMessage;
  expiresAt: number;
}

interface UIState {
  isImmersiveFullscreen: boolean;
  toolbarVisible: boolean;
  chatMode: ChatMode;
  toastQueue: ToastMessage[];
  lastInteractionAt: number;
}

type UIAction =
  | { type: 'INTERACTION' }
  | { type: 'ENTER_FULLSCREEN' }
  | { type: 'EXIT_FULLSCREEN' }
  | { type: 'TOGGLE_TOOLBAR' }
  | { type: 'SHOW_TOOLBAR' }
  | { type: 'HIDE_TOOLBAR' }
  | { type: 'SET_CHAT_MODE'; mode: ChatMode }
  | { type: 'ENQUEUE_TOAST'; toast: ToastMessage }
  | { type: 'EXPIRE_TOAST'; id: string }
  | { type: 'CLEAR_TOASTS' };

const initialState: UIState = {
  isImmersiveFullscreen: false,
  toolbarVisible: true,
  chatMode: 'collapsed',
  toastQueue: [],
  lastInteractionAt: Date.now(),
};

function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'INTERACTION':
      return { ...state, toolbarVisible: true, lastInteractionAt: Date.now() };
    case 'ENTER_FULLSCREEN':
      return { ...state, isImmersiveFullscreen: true, toolbarVisible: false };
    case 'EXIT_FULLSCREEN':
      return { ...state, isImmersiveFullscreen: false, toolbarVisible: true };
    case 'TOGGLE_TOOLBAR':
      return { ...state, toolbarVisible: !state.toolbarVisible };
    case 'SHOW_TOOLBAR':
      return { ...state, toolbarVisible: true };
    case 'HIDE_TOOLBAR':
      return { ...state, toolbarVisible: false };
    case 'SET_CHAT_MODE':
      return {
        ...state,
        chatMode: action.mode,
        // Clear toasts when expanding chat; show toolbar when expanding
        toastQueue: action.mode === 'expanded' ? [] : state.toastQueue,
        toolbarVisible: action.mode === 'expanded' ? true : state.toolbarVisible,
      };
    case 'ENQUEUE_TOAST':
      return {
        ...state,
        toastQueue: [...state.toastQueue.slice(-4), action.toast], // Keep max 5
      };
    case 'EXPIRE_TOAST':
      return {
        ...state,
        toastQueue: state.toastQueue.filter((t) => t.id !== action.id),
      };
    case 'CLEAR_TOASTS':
      return { ...state, toastQueue: [] };
    default:
      return state;
  }
}

// ========== Main Component ==========

interface MobileVideoConferenceProps {
  chatMessageFormatter: (message: string) => React.ReactNode;
  userLanguage: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
}

export function MobileVideoConference({
  chatMessageFormatter,
  userLanguage,
  onLanguageChange,
}: MobileVideoConferenceProps) {
  const [state, dispatch] = useReducer(uiReducer, initialState);
  const [focusedTrack, setFocusedTrack] = React.useState<TrackReferenceOrPlaceholder | null>(null);
  const room = useRoomContext();
  const { chatMessages, send: sendMessage } = useChat();
  const { localParticipant } = useLocalParticipant();
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);
  const toolbarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Fix #1: Track toast timer IDs for cleanup
  const toastTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Get all video tracks
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  // Auto-focus screen shares
  const screenShareTracks = tracks.filter(
    (t) => isTrackReference(t) && t.publication?.source === Track.Source.ScreenShare,
  );

  useEffect(() => {
    if (screenShareTracks.length > 0 && !focusedTrack) {
      setFocusedTrack(screenShareTracks[0]);
    } else if (screenShareTracks.length === 0 && focusedTrack) {
      const isFocusedScreenShare =
        isTrackReference(focusedTrack) &&
        focusedTrack.publication?.source === Track.Source.ScreenShare;
      if (isFocusedScreenShare) {
        setFocusedTrack(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenShareTracks.length]);

  // Auto-hide toolbar after 5s of inactivity (only when chat is NOT expanded)
  useEffect(() => {
    if (toolbarTimerRef.current) {
      clearTimeout(toolbarTimerRef.current);
      toolbarTimerRef.current = null;
    }

    if (state.toolbarVisible && !state.isImmersiveFullscreen && state.chatMode !== 'expanded') {
      toolbarTimerRef.current = setTimeout(() => {
        dispatch({ type: 'HIDE_TOOLBAR' });
      }, 5000);
    }
    return () => {
      if (toolbarTimerRef.current) clearTimeout(toolbarTimerRef.current);
    };
  }, [state.toolbarVisible, state.lastInteractionAt, state.isImmersiveFullscreen, state.chatMode]);

  // Fix #1: Cleanup all toast timers on unmount
  useEffect(() => {
    const timers = toastTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  // Toast management: detect new messages
  useEffect(() => {
    if (chatMessages.length > prevMessageCountRef.current) {
      const newMessages = chatMessages.slice(prevMessageCountRef.current);
      for (const msg of newMessages) {
        // Don't toast own messages
        if (msg.from?.identity === localParticipant.identity) continue;

        if (state.chatMode === 'collapsed') {
          const toastId = `toast-${msg.timestamp}-${Math.random().toString(36).slice(2, 6)}`;
          dispatch({
            type: 'ENQUEUE_TOAST',
            toast: {
              id: toastId,
              message: msg,
              expiresAt: Date.now() + 4000,
            },
          });

          // Fix #1: Store timer ID for cleanup
          const timerId = setTimeout(() => {
            dispatch({ type: 'EXPIRE_TOAST', id: toastId });
            toastTimersRef.current.delete(toastId);
          }, 4000);
          toastTimersRef.current.set(toastId, timerId);
        }
      }
    }
    prevMessageCountRef.current = chatMessages.length;
  }, [chatMessages, state.chatMode, localParticipant.identity]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (state.chatMode === 'expanded') {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages.length, state.chatMode]);

  const handleInteraction = useCallback(() => {
    dispatch({ type: 'INTERACTION' });
  }, []);

  const handleTileTap = useCallback(
    (trackRef: TrackReferenceOrPlaceholder) => {
      if (focusedTrack === trackRef) {
        // Already focused — enter immersive fullscreen
        dispatch({ type: 'ENTER_FULLSCREEN' });
      } else {
        setFocusedTrack(trackRef);
      }
    },
    [focusedTrack],
  );

  const handleFullscreenExit = useCallback(() => {
    dispatch({ type: 'EXIT_FULLSCREEN' });
  }, []);

  const handleFullscreenTap = useCallback(() => {
    // In fullscreen, tapping toggles toolbar
    dispatch({ type: 'TOGGLE_TOOLBAR' });
  }, []);

  const handleChatToggle = useCallback(() => {
    dispatch({
      type: 'SET_CHAT_MODE',
      mode: state.chatMode === 'collapsed' ? 'expanded' : 'collapsed',
    });
  }, [state.chatMode]);

  const handleSendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const input = chatInputRef.current;
      if (!input || !input.value.trim()) return;
      await sendMessage(input.value.trim());
      input.value = '';
    },
    [sendMessage],
  );

  // Filter tracks for composition
  const otherTracks = focusedTrack
    ? tracks.filter((t) => t !== focusedTrack)
    : tracks;

  // Fix #3: Use CSS classes for fullscreen instead of rendering duplicate ParticipantTile
  // The focused tile gets a fullscreen CSS class, avoiding double track subscription
  const isFullscreen = state.isImmersiveFullscreen && focusedTrack;

  return (
    <LayoutContextProvider>
      <div
        className={`mobile-conference ${isFullscreen ? 'mobile-conference--fullscreen' : ''}`}
        onTouchStart={handleInteraction}
        onClick={handleInteraction}
      >
        {/* ===== Video Layer ===== */}
        <div className={`mobile-video-layer ${isFullscreen ? 'mobile-video-layer--fullscreen' : ''}`}>
          {focusedTrack ? (
            <div className={`mobile-focus-layout ${isFullscreen ? 'mobile-focus-layout--fullscreen' : ''}`}>
              {/* Focused participant - goes fullscreen via CSS */}
              <div
                className={`mobile-focus-main ${isFullscreen ? 'mobile-focus-main--fullscreen' : ''}`}
                onClick={(e) => {
                  if (isFullscreen) {
                    handleFullscreenTap();
                  } else {
                    handleTileTap(focusedTrack);
                  }
                }}
              >
                <ParticipantTile trackRef={focusedTrack} />
              </div>
              {/* Carousel - hidden when fullscreen */}
              {!isFullscreen && otherTracks.length > 0 && (
                <div className="mobile-focus-carousel">
                  {otherTracks.map((track, i) => (
                    <div
                      key={`${track.participant.identity}-${track.source}-${i}`}
                      className="mobile-carousel-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFocusedTrack(track);
                      }}
                    >
                      <ParticipantTile trackRef={track} />
                    </div>
                  ))}
                </div>
              )}
              {/* Unfocus/Exit button */}
              {isFullscreen ? (
                <button
                  className="mobile-fullscreen-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFullscreenExit();
                  }}
                  aria-label="Exit fullscreen"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              ) : (
                <button
                  className="mobile-unfocus-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFocusedTrack(null);
                  }}
                  aria-label="Exit focus mode"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" />
                  </svg>
                </button>
              )}
            </div>
          ) : (
            <div className="mobile-grid-layout">
              <GridLayout tracks={tracks}>
                <ParticipantTile
                  onParticipantClick={(evt) => {
                    const clickedTrack = tracks.find(
                      (t) => t.participant.identity === evt.participant.identity,
                    );
                    if (clickedTrack) handleTileTap(clickedTrack);
                  }}
                />
              </GridLayout>
            </div>
          )}
        </div>

        {/* ===== Fullscreen Toolbar (overlaid in fullscreen mode) ===== */}
        {isFullscreen && (
          <div className={`mobile-fullscreen-toolbar ${state.toolbarVisible ? 'visible' : 'hidden'}`}>
            <TrackToggle source={Track.Source.Microphone} />
            <TrackToggle source={Track.Source.Camera} />
            <DisconnectButton />
          </div>
        )}

        {/* ===== Chat Layer ===== */}
        {/* Toast messages (collapsed mode) */}
        {state.chatMode === 'collapsed' && state.toastQueue.length > 0 && !isFullscreen && (
          <div className="mobile-chat-toasts">
            {state.toastQueue.map((toast) => (
              <div
                key={toast.id}
                className="mobile-chat-toast"
                onClick={(e) => {
                  e.stopPropagation();
                  handleChatToggle();
                }}
              >
                <span className="mobile-toast-sender">
                  {toast.message.from?.name || toast.message.from?.identity || 'Unknown'}
                </span>
                <span className="mobile-toast-text">
                  {toast.message.message}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Expanded chat overlay */}
        {state.chatMode === 'expanded' && !isFullscreen && (
          <div className="mobile-chat-overlay" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-chat-header">
              <span>Chat</span>
              <button
                className="mobile-chat-close"
                onClick={handleChatToggle}
                aria-label="Close chat"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="mobile-chat-messages">
              {chatMessages.length === 0 && (
                <div className="mobile-chat-empty">
                  No messages yet. Start the conversation!
                </div>
              )}
              {chatMessages.map((msg, i) => {
                const isLocal = msg.from?.identity === localParticipant.identity;
                return (
                  <div
                    key={`${msg.timestamp}-${i}`}
                    className={`mobile-chat-entry ${isLocal ? 'local' : 'remote'}`}
                  >
                    {!isLocal && (
                      <div className="mobile-chat-sender">
                        {msg.from?.name || msg.from?.identity || 'Unknown'}
                      </div>
                    )}
                    <div className="mobile-chat-bubble">
                      {chatMessageFormatter(msg.message)}
                    </div>
                    <div className="mobile-chat-time">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                );
              })}
              <div ref={chatMessagesEndRef} />
            </div>
            <form className="mobile-chat-input-form" onSubmit={handleSendMessage}>
              <input
                ref={chatInputRef}
                type="text"
                className="mobile-chat-input"
                placeholder="Type a message..."
                autoComplete="off"
                aria-label="Chat message"
              />
              <button type="submit" className="mobile-chat-send" aria-label="Send message">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </form>
          </div>
        )}

        {/* ===== Bottom Toolbar ===== */}
        {!isFullscreen && (
          <div className={`mobile-toolbar ${state.toolbarVisible ? 'visible' : 'hidden'}`}>
            <div className="mobile-toolbar-inner">
              <TrackToggle source={Track.Source.Microphone} />
              <TrackToggle source={Track.Source.Camera} />
              <button
                className={`lk-button mobile-chat-toggle ${state.chatMode === 'expanded' ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleChatToggle();
                }}
                aria-label="Toggle chat"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
                {state.chatMode === 'collapsed' && chatMessages.length > 0 && (
                  <span className="mobile-chat-badge" />
                )}
              </button>
              <DisconnectButton />
            </div>
            {/* Language selector in toolbar */}
            <div className="mobile-toolbar-language">
              <LanguageSelector value={userLanguage} onChange={onLanguageChange} />
            </div>
          </div>
        )}

        {/* Show toolbar toggle button when toolbar is hidden (not in fullscreen) */}
        {!isFullscreen && !state.toolbarVisible && (
          <button
            className="mobile-toolbar-show-btn"
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: 'SHOW_TOOLBAR' });
            }}
            aria-label="Show controls"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>
        )}

        <RoomAudioRenderer />
        <ConnectionStateToast />
        <StartAudio label="Click to allow audio playback" />
      </div>
    </LayoutContextProvider>
  );
}

export default MobileVideoConference;
