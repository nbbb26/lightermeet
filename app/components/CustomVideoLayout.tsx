'use client';

import React, { useEffect, useState } from 'react';
import {
  GridLayout,
  ParticipantTile,
  useLocalParticipant,
  useParticipants,
  useTracks,
  ControlBar,
  Chat,
  useRoomContext,
  LayoutContextProvider,
  usePinnedTracks,
  FocusLayout,
  CarouselLayout,
} from '@livekit/components-react';
import { Track, RoomEvent } from 'livekit-client';
import { LanguageSelector } from './TranslatedChat';
import { LanguageCode } from '@/lib/translation';
import type { MessageFormatter } from '@livekit/components-react';

interface CustomVideoLayoutProps {
  userLanguage: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  chatMessageFormatter?: MessageFormatter;
}

export function CustomVideoLayout({
  userLanguage,
  onLanguageChange,
  chatMessageFormatter,
}: CustomVideoLayoutProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const room = useRoomContext();
  const participants = useParticipants();
  const localParticipant = useLocalParticipant();
  
  // Get all video tracks
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  // Separate local and remote tracks
  const localTrack = tracks.find(
    (track) => track.participant.isLocal && track.source === Track.Source.Camera
  );
  const remoteTracks = tracks.filter(
    (track) => !track.participant.isLocal || track.source === Track.Source.ScreenShare
  );

  // Check if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 600);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Listen for participant changes
  useEffect(() => {
    const handleParticipantChange = () => {
      // Force re-render on participant changes
    };
    room.on(RoomEvent.ParticipantConnected, handleParticipantChange);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantChange);
    return () => {
      room.off(RoomEvent.ParticipantConnected, handleParticipantChange);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantChange);
    };
  }, [room]);

  const hasRemoteParticipants = remoteTracks.length > 0;

  return (
    <LayoutContextProvider>
      <div className="lk-video-conference custom-video-layout">
        <div className="lk-video-conference-inner">
          {/* Main video area */}
          <div className="lk-focus-layout-wrapper custom-main-area">
            {/* Remote participants grid */}
            <div className="custom-remote-grid">
              {hasRemoteParticipants ? (
                <GridLayout tracks={remoteTracks}>
                  <ParticipantTile />
                </GridLayout>
              ) : (
                /* Show local participant in center if alone */
                <div className="custom-alone-view">
                  {localTrack && (
                    <ParticipantTile 
                      trackRef={localTrack}
                      className="custom-alone-tile"
                    />
                  )}
                  <div className="custom-waiting-message">
                    <p>Waiting for others to join...</p>
                    <p className="custom-room-info">
                      Share this link to invite others
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Self-view PIP (only on desktop when not alone) */}
            {!isMobile && hasRemoteParticipants && localTrack && (
              <div className="custom-pip-container">
                <ParticipantTile
                  trackRef={localTrack}
                  className="custom-pip-tile"
                />
              </div>
            )}

            {/* Mobile self-view (small corner) */}
            {isMobile && hasRemoteParticipants && localTrack && (
              <div className="custom-mobile-pip">
                <ParticipantTile
                  trackRef={localTrack}
                  className="custom-mobile-pip-tile"
                />
              </div>
            )}
          </div>

          {/* Control bar */}
          <ControlBar
            variation="minimal"
            controls={{
              chat: true,
              screenShare: !isMobile,
              leave: true,
            }}
          />
        </div>

        {/* Chat panel */}
        {showChat && (
          <Chat 
            messageFormatter={chatMessageFormatter}
            className={isMobile ? 'custom-mobile-chat' : ''}
          />
        )}

        {/* Language selector overlay */}
        <div className="custom-language-selector">
          <LanguageSelector
            value={userLanguage}
            onChange={onLanguageChange}
          />
        </div>
      </div>

      <style jsx global>{`
        .custom-video-layout {
          position: relative;
          width: 100%;
          height: 100%;
        }

        .custom-main-area {
          position: relative;
          width: 100%;
          height: 100%;
        }

        .custom-remote-grid {
          width: 100%;
          height: 100%;
        }

        /* Desktop PIP */
        .custom-pip-container {
          position: fixed;
          top: 1rem;
          right: 1rem;
          width: 200px;
          z-index: 100;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
          border: 2px solid rgba(255, 255, 255, 0.2);
          transition: all 0.2s ease;
        }

        .custom-pip-container:hover {
          transform: scale(1.05);
          border-color: rgba(255, 255, 255, 0.4);
        }

        .custom-pip-tile {
          width: 100%;
          aspect-ratio: 16 / 10;
        }

        .custom-pip-tile video {
          object-fit: cover;
        }

        /* Mobile PIP */
        .custom-mobile-pip {
          position: fixed;
          top: 0.5rem;
          right: 0.5rem;
          width: 100px;
          z-index: 100;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .custom-mobile-pip-tile {
          width: 100%;
          aspect-ratio: 1;
        }

        /* Alone view */
        .custom-alone-view {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          padding: 2rem;
          gap: 2rem;
        }

        .custom-alone-tile {
          max-width: 600px;
          width: 100%;
          aspect-ratio: 16 / 10;
          border-radius: 12px;
          overflow: hidden;
        }

        .custom-waiting-message {
          text-align: center;
          color: rgba(255, 255, 255, 0.7);
        }

        .custom-waiting-message p {
          margin: 0.5rem 0;
        }

        .custom-room-info {
          font-size: 0.875rem;
          color: rgba(255, 255, 255, 0.5);
        }

        /* Language selector */
        .custom-language-selector {
          position: fixed;
          top: 1rem;
          left: 1rem;
          z-index: 100;
          background: rgba(0, 0, 0, 0.7);
          padding: 0.5rem 1rem;
          border-radius: 8px;
          backdrop-filter: blur(8px);
        }

        @media (min-width: 601px) {
          .custom-language-selector {
            top: auto;
            bottom: calc(69px + 1rem);
            left: 1rem;
          }
        }

        /* Mobile chat overlay */
        @media (max-width: 600px) {
          .custom-mobile-chat.lk-chat {
            background: linear-gradient(
              to top,
              rgba(0, 0, 0, 0.9) 0%,
              rgba(0, 0, 0, 0.6) 40%,
              transparent 100%
            );
            border-left: none;
          }

          .custom-mobile-chat .lk-chat-header {
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(8px);
          }

          .custom-mobile-chat .lk-chat-messages {
            background: transparent;
          }

          .custom-mobile-chat .lk-chat-form {
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(10px);
          }

          .custom-mobile-chat .lk-message-body {
            text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(4px);
          }

          .custom-language-selector {
            top: 0.5rem;
            left: 0.5rem;
            padding: 0.25rem 0.5rem;
            font-size: 0.875rem;
          }
        }
      `}</style>
    </LayoutContextProvider>
  );
}

export default CustomVideoLayout;
