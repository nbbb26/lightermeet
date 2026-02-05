'use client';

import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { encodePassphrase, generateRoomId, randomString } from '@/lib/client-utils';
import styles from '../styles/Home.module.css';

export default function Page() {
  const router = useRouter();
  const [e2ee, setE2ee] = useState(false);
  const [sharedPassphrase, setSharedPassphrase] = useState(randomString(64));

  const startMeeting = () => {
    if (e2ee) {
      router.push(`/rooms/${generateRoomId()}#${encodePassphrase(sharedPassphrase)}`);
    } else {
      router.push(`/rooms/${generateRoomId()}`);
    }
  };

  return (
    <>
      <main className={styles.main} data-lk-theme="default">
        <div className="header">
          <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>LighterMeet</h1>
          <h2 style={{ fontWeight: 'normal' }}>
            Simple video conferencing powered by{' '}
            <a href="https://livekit.io" rel="noopener" target="_blank">
              LiveKit
            </a>
          </h2>
        </div>

        <div className={styles.tabContent} style={{ maxWidth: '500px', margin: '2rem auto' }}>
          <button
            style={{ marginTop: '1rem', fontSize: '1.2rem', padding: '1rem 2rem' }}
            className="lk-button"
            onClick={startMeeting}
          >
            Start New Meeting
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '1rem', alignItems: 'center' }}>
              <input
                id="use-e2ee"
                type="checkbox"
                checked={e2ee}
                onChange={(ev) => setE2ee(ev.target.checked)}
              />
              <label htmlFor="use-e2ee">Enable end-to-end encryption</label>
            </div>
            {e2ee && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label htmlFor="passphrase">Passphrase:</label>
                <input
                  id="passphrase"
                  type="password"
                  value={sharedPassphrase}
                  onChange={(ev) => setSharedPassphrase(ev.target.value)}
                  style={{ padding: '0.5rem' }}
                />
              </div>
            )}
          </div>
        </div>
      </main>
      <footer data-lk-theme="default">
        Open source video conferencing.{' '}
        <a href="https://github.com/yourusername/lightermeet" rel="noopener" target="_blank">
          View on GitHub
        </a>
      </footer>
    </>
  );
}
