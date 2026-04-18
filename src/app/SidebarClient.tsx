'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/i18n/LanguageContext';

export default function SidebarClient() {
    const { locale, setLocale, t } = useTranslation();
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    // Close drawer on route change
    useEffect(() => {
        setOpen(false);
    }, [pathname]);

    // Prevent body scroll when drawer open on mobile
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [open]);

    return (
        <>
            {/* Mobile top bar with hamburger */}
            <header className="mobile-header">
                <button
                    type="button"
                    className="mobile-menu-btn"
                    aria-label="Open menu"
                    aria-expanded={open}
                    onClick={() => setOpen(true)}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
                </button>
                <div className="mobile-header-brand">
                    <span className="sidebar-logo">🏠</span>
                    <h2>Corn Island</h2>
                </div>
            </header>

            {open && (
                <div
                    className="sidebar-backdrop"
                    onClick={() => setOpen(false)}
                    aria-hidden="true"
                />
            )}

            <aside className={`sidebar ${open ? 'is-open' : ''}`}>
            <div className="sidebar-brand">
                <span className="sidebar-logo">🏠</span>
                <h2>Corn Island</h2>
            </div>
            <nav className="sidebar-nav">
                <Link href="/" className="nav-link" id="nav-dashboard">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
                    {t.nav.dashboard}
                </Link>
                <Link href="/volunteers" className="nav-link" id="nav-volunteers">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                    {t.nav.volunteers}
                </Link>
                <Link href="/planning" className="nav-link" id="nav-planning">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                    {t.nav.planning}
                </Link>
                <Link href="/calendar" className="nav-link" id="nav-calendar">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="10" y1="14" x2="14" y2="14" /><line x1="10" y1="18" x2="14" y2="18" /></svg>
                    {t.nav.calendar}
                </Link>
                <Link href="/watchman" className="nav-link" id="nav-watchman">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
                    {t.nav.watchman}
                </Link>
            </nav>

            {/* Language Toggle */}
            <div className="lang-toggle">
                <button
                    className={`lang-btn ${locale === 'en' ? 'active' : ''}`}
                    onClick={() => setLocale('en')}
                    title="English"
                    aria-label="Switch to English"
                >
                    <span className="lang-flag">🇺🇸</span>
                    <span className="lang-label">EN</span>
                </button>
                <button
                    className={`lang-btn ${locale === 'es' ? 'active' : ''}`}
                    onClick={() => setLocale('es')}
                    title="Español"
                    aria-label="Cambiar a Español"
                >
                    <span className="lang-flag">🇳🇮</span>
                    <span className="lang-label">ES</span>
                </button>
            </div>
            </aside>
        </>
    );
}
