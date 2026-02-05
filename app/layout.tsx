import '../styles/globals.css';
import '@livekit/components-styles';
import '@livekit/components-styles/prefabs';
import type { Metadata, Viewport } from 'next';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: {
    default: 'LighterMeet | Simple Video Conferencing',
    template: '%s',
  },
  description:
    'LighterMeet is a simple, open source video conferencing app built with LiveKit and Next.js.',
  twitter: {
    creator: '@nicbot',
    site: '@nicbot',
    card: 'summary_large_image',
  },
  openGraph: {
    url: 'https://lightermeet.vercel.app',
    images: [
      {
        url: 'https://lightermeet.vercel.app/images/lightermeet-og.png',
        width: 2000,
        height: 1000,
        type: 'image/png',
      },
    ],
    siteName: 'LighterMeet',
  },
  icons: {
    icon: {
      rel: 'icon',
      url: '/favicon.ico',
    },
    apple: [
      {
        rel: 'apple-touch-icon',
        url: '/images/livekit-apple-touch.png',
        sizes: '180x180',
      },
      { rel: 'mask-icon', url: '/images/livekit-safari-pinned-tab.svg', color: '#070707' },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#070707',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body data-lk-theme="default">
        <Toaster />
        {children}
      </body>
    </html>
  );
}
