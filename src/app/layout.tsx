import type { Metadata, Viewport } from 'next';
import { Outfit } from 'next/font/google';
import { LanguageProvider } from '@/i18n/LanguageContext';
import AppShell from './AppShell';
import './globals.css';
import { startReminderScheduler } from '@/lib/reminders';

const baseFont = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-outfit',
});

export const metadata: Metadata = {
  title: 'Corn Island Hospitality',
  description: 'Manage volunteers and hospitality capacity for the Corn Island project.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Start the reminder scheduler in the background. Idempotent and safe.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    startReminderScheduler().catch((err) => {
      console.error('[layout] failed to start reminder scheduler', err);
    });
  }

  return (
    <html lang="en" className={`${baseFont.variable} ${baseFont.className}`}>

      <body>
        <LanguageProvider>
          <AppShell>
            {children}
          </AppShell>
        </LanguageProvider>
      </body>
    </html>
  );
}

