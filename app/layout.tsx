import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Fraunces, Schibsted_Grotesk, Spline_Sans_Mono } from 'next/font/google';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { SWRConfig } from 'swr';

export const metadata: Metadata = {
  title: 'Alp Navigator — Quote Builder',
  description: 'Build and share luxury travel quotes in minutes.',
};

export const viewport: Viewport = { maximumScale: 1 };

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  axes: ['opsz', 'SOFT', 'WONK'],
});

const schibsted = Schibsted_Grotesk({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const splineMono = Spline_Sans_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${schibsted.variable} ${splineMono.variable}`}
    >
      <body className="min-h-[100dvh] bg-paper">
        <SWRConfig
          value={{
            fallback: {
              '/api/user': getUser(),
              '/api/team': getTeamForUser(),
            },
          }}
        >
          {children}
        </SWRConfig>
      </body>
    </html>
  );
}
