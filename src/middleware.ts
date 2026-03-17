import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const isLoginPage = request.nextUrl.pathname.startsWith('/login');
    const authCookie = request.cookies.get('ci_auth')?.value;

    if (!authCookie && !isLoginPage) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    if (authCookie && isLoginPage) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
