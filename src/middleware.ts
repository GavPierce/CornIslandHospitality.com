import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Middleware runs in the Edge runtime and cannot talk to Prisma. It only
// checks for the *presence* of a session cookie; server components call
// `getSession()` to validate the token and pull the user record. Invalid
// or expired sessions are handled page-side (they'll see the login form
// again because `getSession()` returns null and we redirect).
const SESSION_COOKIE = 'ci_session';

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const isLoginPage = pathname.startsWith('/login');

    // The WhatsApp pairing page must be reachable *before* anyone can log
    // in (you can't log in until WA is paired and someone's phone exists
    // in the DB). The page itself checks either an admin session or the
    // `WA_SETUP_TOKEN` env token, so it's safe to skip the session check
    // here.
    const isWhatsAppSetup = pathname.startsWith('/admin/whatsapp-setup');

    // Same story for the first-run bootstrap page: it has to be reachable
    // before any user exists. The page validates the same WA_SETUP_TOKEN
    // and refuses to run after the first user is created.
    const isBootstrap = pathname.startsWith('/admin/bootstrap');

    const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

    if (!hasSessionCookie && !isLoginPage && !isWhatsAppSetup && !isBootstrap) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    if (hasSessionCookie && isLoginPage) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
