'use client';

import React from 'react';
import { decodePassphrase } from '@/lib/client-utils';
import { DebugMode } from '@/lib/Debug';
import { KeyboardShortcuts } from '@/lib/KeyboardShortcuts';
import { RecordingIndicator } from '@/lib/RecordingIndicator';
import { SettingsMenu } from '@/lib/SettingsMenu';
import { ConnectionDetails } from '@/lib/types';
import { AuthTokenProvider } from '@/lib/AuthContext';
import {
  formatChatMessageLinks,
  LocalUserChoices,
  PreJoin,
  RoomContext,
  VideoConference,
} from '@livekit/components-react';
import {
  ExternalE2EEKeyProvider,
  RoomOptions,
  VideoCodec,
  VideoPresets,
  Room,
  DeviceUnsupportedError,
  RoomConnectOptions,
  RoomEvent,
  TrackPublishDefaults,
  VideoCaptureOptions,
} from 'livekit-client';
import { useRouter } from 'next/navigation';
import { useSetupE2EE } from '@/lib/useSetupE2EE';
import { useLowCPUOptimizer } from '@/lib/usePerfomanceOptimiser';
import { LanguageSelector } from '@/app/components/TranslatedChat';
import { LanguageCode } from '@/lib/translation';
import { useTranslatedChat } from './useTranslatedChat';

const CONN_DETAILS_ENDPOINT =
  process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? '/api/connection-details';
const SHOW_SETTINGS_MENU = process.env.NEXT_PUBLIC_SHOW_SETTINGS_MENU == 'true';

export function PageClientImpl(props: {
  roomName: string;
  region?: string;
  hq: boolean;
  codec: VideoCodec;
}) {
  const [preJoinChoices, setPreJoinChoices] = React.useState<LocalUserChoices | undefined>(
    undefined,
  );
  const preJoinDefaults = React.useMemo(() => {
    return {
      username: '',
      videoEnabled: true,
      audioEnabled: true,
    };
  }, []);
  const [connectionDetails, setConnectionDetails] = React.useState<ConnectionDetails | undefined>(
    undefined,
  );
  const [userLanguage, setUserLanguage] = React.useState<LanguageCode>('en');
  const [preJoinError, setPreJoinError] = React.useState<string | null>(null);

  // Issue #7: Harden pre-join fetch error handling
  const handlePreJoinSubmit = React.useCallback(async (values: LocalUserChoices) => {
    setPreJoinChoices(values);
    setPreJoinError(null);

    try {
      const url = new URL(CONN_DETAILS_ENDPOINT, window.location.origin);
      url.searchParams.append('roomName', props.roomName);
      url.searchParams.append('participantName', values.username);
      if (props.region) {
        url.searchParams.append('region', props.region);
      }
      const connectionDetailsResp = await fetch(url.toString());

      if (!connectionDetailsResp.ok) {
        const errorText = await connectionDetailsResp.text().catch(() => 'Unknown error');
        throw new Error(`Failed to get connection details: ${errorText}`);
      }

      const connectionDetailsData = await connectionDetailsResp.json();

      // Validate response shape
      if (
        !connectionDetailsData.serverUrl ||
        !connectionDetailsData.participantToken ||
        typeof connectionDetailsData.serverUrl !== 'string' ||
        typeof connectionDetailsData.participantToken !== 'string'
      ) {
        throw new Error('Invalid connection details received from server');
      }

      setConnectionDetails(connectionDetailsData);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect';
      console.error('Pre-join connection error:', error);
      setPreJoinError(message);
      setPreJoinChoices(undefined); // Reset so user can retry
    }
  }, [props.roomName, props.region]);

  const handlePreJoinError = React.useCallback((e: Error) => {
    console.error('Pre-join error:', e);
    setPreJoinError(e.message);
  }, []);

  return (
    <main data-lk-theme="default" style={{ height: '100%' }}>
      {connectionDetails === undefined || preJoinChoices === undefined ? (
        <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
          <div style={{ width: '100%', maxWidth: '400px' }}>
            {preJoinError && (
              <div style={{
                padding: '0.75rem 1rem',
                marginBottom: '1rem',
                background: 'rgba(255, 80, 80, 0.15)',
                border: '1px solid rgba(255, 80, 80, 0.3)',
                borderRadius: '8px',
                color: '#ff6b6b',
                fontSize: '0.9rem',
              }}>
                {preJoinError}
              </div>
            )}
            <PreJoin
              defaults={preJoinDefaults}
              onSubmit={handlePreJoinSubmit}
              onError={handlePreJoinError}
            />
            <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
              <LanguageSelector 
                value={userLanguage} 
                onChange={setUserLanguage}
              />
            </div>
          </div>
        </div>
      ) : (
        <VideoConferenceComponent
          connectionDetails={connectionDetails}
          userChoices={preJoinChoices}
          userLanguage={userLanguage}
          onLanguageChange={setUserLanguage}
          options={{ codec: props.codec, hq: props.hq }}
        />
      )}
    </main>
  );
}

function VideoConferenceComponent(props: {
  userChoices: LocalUserChoices;
  connectionDetails: ConnectionDetails;
  userLanguage: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  options: {
    hq: boolean;
    codec: VideoCodec;
  };
}) {
  // Issue #4: Use useRef for keyProvider and useMemo for worker to ensure stable lifecycle
  const keyProviderRef = React.useRef<ExternalE2EEKeyProvider>(new ExternalE2EEKeyProvider());
  const { worker, e2eePassphrase } = useSetupE2EE();
  const e2eeEnabled = !!(e2eePassphrase && worker);

  const [e2eeSetupComplete, setE2eeSetupComplete] = React.useState(false);

  // Issue #3: Define callbacks BEFORE any hooks/effects that reference them (TDZ fix)
  const router = useRouter();
  const handleOnLeave = React.useCallback(() => router.push('/'), [router]);
  const handleError = React.useCallback((error: Error) => {
    console.error(error);
    alert(`Encountered an unexpected error, check the console logs for details: ${error.message}`);
  }, []);
  const handleEncryptionError = React.useCallback((error: Error) => {
    console.error(error);
    alert(
      `Encountered an unexpected encryption error, check the console logs for details: ${error.message}`,
    );
  }, []);

  // Issue #5: Include all relevant dependencies in roomOptions memo
  const roomOptions = React.useMemo((): RoomOptions => {
    let videoCodec: VideoCodec | undefined = props.options.codec ? props.options.codec : 'vp9';
    if (e2eeEnabled && (videoCodec === 'av1' || videoCodec === 'vp9')) {
      videoCodec = undefined;
    }
    const videoCaptureDefaults: VideoCaptureOptions = {
      deviceId: props.userChoices.videoDeviceId ?? undefined,
      resolution: props.options.hq ? VideoPresets.h2160 : VideoPresets.h720,
    };
    const publishDefaults: TrackPublishDefaults = {
      dtx: false,
      videoSimulcastLayers: props.options.hq
        ? [VideoPresets.h1080, VideoPresets.h720]
        : [VideoPresets.h540, VideoPresets.h216],
      red: !e2eeEnabled,
      videoCodec,
    };
    return {
      videoCaptureDefaults: videoCaptureDefaults,
      publishDefaults: publishDefaults,
      audioCaptureDefaults: {
        deviceId: props.userChoices.audioDeviceId ?? undefined,
      },
      adaptiveStream: true,
      dynacast: true,
      e2ee: e2eeEnabled && worker
        ? { keyProvider: keyProviderRef.current, worker }
        : undefined,
      singlePeerConnection: true,
    };
  }, [props.userChoices, props.options.hq, props.options.codec, e2eeEnabled, worker]);

  // Issue #5: Room should be created with roomOptions as dependency
  const room = React.useMemo(() => new Room(roomOptions), [roomOptions]);

  React.useEffect(() => {
    if (e2eeEnabled) {
      keyProviderRef.current
        .setKey(decodePassphrase(e2eePassphrase))
        .then(() => {
          room.setE2EEEnabled(true).catch((e) => {
            if (e instanceof DeviceUnsupportedError) {
              alert(
                `You're trying to join an encrypted meeting, but your browser does not support it. Please update it to the latest version and try again.`,
              );
              console.error(e);
            } else {
              throw e;
            }
          });
        })
        .then(() => setE2eeSetupComplete(true));
    } else {
      setE2eeSetupComplete(true);
    }
  }, [e2eeEnabled, room, e2eePassphrase]);

  const connectOptions = React.useMemo((): RoomConnectOptions => {
    return {
      autoSubscribe: true,
    };
  }, []);

  // Issue #6: Add room.disconnect() cleanup on unmount
  React.useEffect(() => {
    room.on(RoomEvent.Disconnected, handleOnLeave);
    room.on(RoomEvent.EncryptionError, handleEncryptionError);
    room.on(RoomEvent.MediaDevicesError, handleError);

    if (e2eeSetupComplete) {
      room
        .connect(
          props.connectionDetails.serverUrl,
          props.connectionDetails.participantToken,
          connectOptions,
        )
        .catch((error) => {
          handleError(error);
        });
      if (props.userChoices.videoEnabled) {
        room.localParticipant.setCameraEnabled(true).catch((error) => {
          handleError(error);
        });
      }
      if (props.userChoices.audioEnabled) {
        room.localParticipant.setMicrophoneEnabled(true).catch((error) => {
          handleError(error);
        });
      }
    }
    return () => {
      room.off(RoomEvent.Disconnected, handleOnLeave);
      room.off(RoomEvent.EncryptionError, handleEncryptionError);
      room.off(RoomEvent.MediaDevicesError, handleError);
      // Issue #6: Disconnect room and stop local tracks on cleanup
      room.disconnect(true).catch((e) => console.error('Room disconnect error:', e));
    };
  }, [
    e2eeSetupComplete,
    room,
    props.connectionDetails,
    props.userChoices,
    connectOptions,
    handleOnLeave,
    handleEncryptionError,
    handleError,
  ]);

  const lowPowerMode = useLowCPUOptimizer(room);
  // Pass participant token to useTranslatedChat for authenticated API calls
  const translatedChatFormatter = useTranslatedChat(
    props.userLanguage,
    true,
    props.connectionDetails.participantToken,
  );

  // Issue #4: Cleanup worker on unmount
  React.useEffect(() => {
    return () => {
      if (worker) {
        worker.terminate();
      }
    };
  }, [worker]);

  React.useEffect(() => {
    if (lowPowerMode) {
      console.warn('Low power mode enabled');
    }
  }, [lowPowerMode]);

  return (
    <div className="lk-room-container">
      <AuthTokenProvider token={props.connectionDetails.participantToken}>
        <RoomContext.Provider value={room}>
          <KeyboardShortcuts />
          <VideoConference
            chatMessageFormatter={translatedChatFormatter}
            SettingsComponent={SHOW_SETTINGS_MENU ? SettingsMenu : undefined}
          />
          <DebugMode />
          <RecordingIndicator />
          {/* Language selector overlay */}
          <div className="lightermeet-language-overlay">
            <LanguageSelector 
              value={props.userLanguage} 
              onChange={props.onLanguageChange}
            />
          </div>
        </RoomContext.Provider>
      </AuthTokenProvider>
    </div>
  );
}
