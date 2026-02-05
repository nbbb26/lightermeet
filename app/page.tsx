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
          <h1 style={{ fontSize: '3rem', marginBottom: '1rem', fontWeight: 600 }}>
            LighterMeet
          </h1>
          <h2 style={{ fontWeight: 'normal' }}>
            Simple video conferencing with automatic translation
          </h2>
          <p style={{ 
            marginTop: '0.5rem', 
            fontSize: '0.9rem', 
            opacity: 0.7 
          }}>
            Powered by{' '}
            <a href="https://livekit.io" rel="noopener" target="_blank">
              LiveKit
            </a>
          </p>
        </div>

        <div className={styles.tabContent} style={{ maxWidth: '500px', margin: '2rem auto' }}>
          <button
            style={{ 
              marginTop: '1rem', 
              fontSize: '1.2rem', 
              padding: '1rem 2rem',
              width: '100%',
              fontWeight: 600
            }}
            className="lk-button"
            onClick={startMeeting}
            aria-label="Start a new video meeting"
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
                aria-describedby="e2ee-description"
                style={{ cursor: 'pointer', width: '1.25rem', height: '1.25rem' }}
              />
              <label htmlFor="use-e2ee" style={{ cursor: 'pointer', userSelect: 'none' }}>
                Enable end-to-end encryption
              </label>
            </div>
            <p id="e2ee-description" style={{ fontSize: '0.85rem', opacity: 0.6, marginTop: '-0.5rem' }}>
              Secure your meeting with end-to-end encryption
            </p>
            {e2ee && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                <label htmlFor="passphrase" style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                  Passphrase:
                </label>
                <input
                  id="passphrase"
                  type="password"
                  value={sharedPassphrase}
                  onChange={(ev) => setSharedPassphrase(ev.target.value)}
                  style={{ 
                    padding: '0.75rem', 
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'white',
                    fontSize: '0.9rem'
                  }}
                  aria-label="Encryption passphrase"
                  placeholder="Enter a secure passphrase"
                />
                <p style={{ fontSize: '0.85rem', opacity: 0.6 }}>
                  Share this passphrase with meeting participants
                </p>
              </div>
            )}
          </div>

          <div style={{ 
            marginTop: '3rem', 
            padding: '1.5rem', 
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', fontWeight: 600 }}>
              ✨ Features
            </h3>
            <ul style={{ 
              listStyle: 'none', 
              padding: 0, 
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              fontSize: '0.9rem',
              opacity: 0.8
            }}>
              <li>🌍 Automatic chat translation (17 languages)</li>
              <li>🎥 High-quality video conferencing</li>
              <li>🔒 Optional end-to-end encryption</li>
              <li>📱 Mobile-optimized interface</li>
            </ul>
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
