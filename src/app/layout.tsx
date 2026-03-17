import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import { LanguageProvider } from '@/i18n/LanguageContext';
import SidebarClient from './SidebarClient';
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${baseFont.variable} ${baseFont.className}`}>
      <body>
        <LanguageProvider>
          <div className="app-shell">
            <SidebarClient />
            <main className="main-content">
              {children}
            </main>
          </div>
        </LanguageProvider>
      </body>
    </html>
  );
}
