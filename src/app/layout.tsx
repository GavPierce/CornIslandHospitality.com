import type { Metadata, Viewport } from 'next';
import { Outfit } from 'next/font/google';
import { LanguageProvider } from '@/i18n/LanguageContext';
import AppShell from './AppShell';
import './globals.css';

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

