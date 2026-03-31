'use client';

import { usePathname } from 'next/navigation';
import SidebarClient from './SidebarClient';

export default function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isLoginPage = pathname === '/login';

    if (isLoginPage) {
        return <>{children}</>;
    }

    return (
        <div className="app-shell">
            <SidebarClient />
            <main className="main-content">
                {children}
            </main>
        </div>
    );
}
