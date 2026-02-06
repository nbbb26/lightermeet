'use client';

import { formatChatMessageLinks, RoomContext, VideoConference } from '@livekit/components-react';
import {
  ExternalE2EEKeyProvider,
  LogLevel,
  Room,
  RoomConnectOptions,
  RoomOptions,
  VideoPresets,
  type VideoCodec,
} from 'livekit-client';
import { DebugMode } from '@/lib/Debug';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardShortcuts } from '@/lib/KeyboardShortcuts';
import { SettingsMenu } from '@/lib/SettingsMenu';
import { useSetupE2EE } from '@/lib/useSetupE2EE';
import { useLowCPUOptimizer } from '@/lib/usePerfomanceOptimiser';
import { AuthTokenProvider } from '@/lib/AuthContext';

export function VideoConferenceClientImpl(props: {
  liveKitUrl: string;
  token: string;
  codec: VideoCodec | undefined;
  singlePeerConnection: boolean | undefined;
}) {
  // Issue #4: Use useRef for keyProvider to maintain stable reference
  const keyProviderRef = useRef<ExternalE2EEKeyProvider>(new ExternalE2EEKeyProvider());
  const { worker, e2eePassphrase } = useSetupE2EE();
  const e2eeEnabled = !!(e2eePassphrase && worker);

  const [e2eeSetupComplete, setE2eeSetupComplete] = useState(false);

  // Issue #5: Include proper dependencies in roomOptions
  const roomOptions = useMemo((): RoomOptions => {
    return {
      publishDefaults: {
        videoSimulcastLayers: [VideoPresets.h540, VideoPresets.h216],
        red: !e2eeEnabled,
        videoCodec: props.codec,
      },
      adaptiveStream: { pixelDensity: 'screen' },
      dynacast: true,
      e2ee: e2eeEnabled && worker
        ? {
            keyProvider: keyProviderRef.current,
            worker,
          }
        : undefined,
      singlePeerConnection: props.singlePeerConnection,
    };
  }, [e2eeEnabled, props.codec, props.singlePeerConnection, worker]);

  const room = useMemo(() => new Room(roomOptions), [roomOptions]);

  // Reset e2eeSetupComplete when room instance changes to prevent connect race
  useEffect(() => {
    setE2eeSetupComplete(false);
  }, [room]);

  const connectOptions = useMemo((): RoomConnectOptions => {
    return {
      autoSubscribe: true,
    };
  }, []);

  useEffect(() => {
    if (e2eeEnabled && e2eePassphrase) {
      keyProviderRef.current.setKey(e2eePassphrase).then(() => {
        room.setE2EEEnabled(true).then(() => {
          setE2eeSetupComplete(true);
        });
      });
    } else {
      setE2eeSetupComplete(true);
    }
  }, [e2eeEnabled, e2eePassphrase, room]);

  // Issue #6: Add room.disconnect() cleanup on unmount
  useEffect(() => {
    if (e2eeSetupComplete) {
      room.connect(props.liveKitUrl, props.token, connectOptions).catch((error) => {
        console.error(error);
      });
      room.localParticipant.enableCameraAndMicrophone().catch((error) => {
        console.error(error);
      });
    }
    return () => {
      room.disconnect(true).catch((e) => console.error('Room disconnect error:', e));
    };
  }, [room, props.liveKitUrl, props.token, connectOptions, e2eeSetupComplete]);

  // Issue #4: Cleanup worker on unmount
  useEffect(() => {
    return () => {
      if (worker) {
        worker.terminate();
      }
    };
  }, [worker]);

  useLowCPUOptimizer(room);

  return (
    <div className="lk-room-container">
      <AuthTokenProvider token={props.token}>
        <RoomContext.Provider value={room}>
          <KeyboardShortcuts />
          <VideoConference
            chatMessageFormatter={formatChatMessageLinks}
            SettingsComponent={
              process.env.NEXT_PUBLIC_SHOW_SETTINGS_MENU === 'true' ? SettingsMenu : undefined
            }
          />
          <DebugMode logLevel={LogLevel.debug} />
        </RoomContext.Provider>
      </AuthTokenProvider>
    </div>
  );
}
