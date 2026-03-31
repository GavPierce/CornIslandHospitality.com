import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const VALID_ROLES = ['admin', 'viewer'];

export function middleware(request: NextRequest) {
    const isLoginPage = request.nextUrl.pathname.startsWith('/login');
    const authCookie = request.cookies.get('ci_auth')?.value;
    const isAuthenticated = authCookie && VALID_ROLES.includes(authCookie);

    if (!isAuthenticated && !isLoginPage) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    if (isAuthenticated && isLoginPage) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
