import React from 'react';
import { decodePassphrase } from './client-utils';

export function useSetupE2EE() {
  const e2eePassphrase =
    typeof window !== 'undefined' ? decodePassphrase(location.hash.substring(1)) : undefined;

  // Issue #4: Create worker with useMemo to avoid re-creating on every render
  const worker = React.useMemo(() => {
    if (typeof window !== 'undefined' && e2eePassphrase) {
      return new Worker(new URL('livekit-client/e2ee-worker', import.meta.url));
    }
    return undefined;
    // e2eePassphrase is derived from location.hash which doesn't change within the same page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { worker, e2eePassphrase };
}
