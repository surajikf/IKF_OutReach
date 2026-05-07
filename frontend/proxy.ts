import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function proxy(request: NextRequest) {
    const token = await getToken({ 
        req: request, 
        secret: process.env.NEXTAUTH_SECRET 
    });
    const { pathname } = request.nextUrl;
    const withBasePath = (path: string) => `${request.nextUrl.basePath || ""}${path === "/" ? "" : path}` || "/";

    // 1. Allow public access to APIs, Next.js internal routes, and static files.
    if (
        pathname.startsWith('/api') ||
        pathname.startsWith('/_next') ||
        pathname === '/favicon.ico' ||
        pathname.includes('.')
    ) {
        return NextResponse.next();
    }

    // 2. Auth and status routes logic
    const isAuthRoute = pathname === '/login' || pathname === '/register' || pathname === '/forgot-password';
    const status = (token as any)?.status || 'APPROVED';

    // Public auth pages: logged-in users should not stay on login/register screens.
    if (isAuthRoute) {
        if (token) {
            if (status === 'PENDING') {
                return NextResponse.redirect(new URL(withBasePath('/pending-approval'), request.url));
            }
            if (status === 'BANNED') {
                return NextResponse.redirect(new URL(withBasePath('/banned'), request.url));
            }
            return NextResponse.redirect(new URL(withBasePath('/'), request.url));
        }
        return NextResponse.next();
    }

    // 3. Protected Routes logic
    if (!token) {
        return NextResponse.redirect(new URL(withBasePath('/login'), request.url));
    }

    // 4. Role-based logic
    const role = (token as any).role;

    // Admin Routes logic
    if (pathname.startsWith('/admin') && role !== 'ADMIN') {
        return NextResponse.redirect(new URL(withBasePath('/'), request.url));
    }

    // Redirect users by account status
    if (status === 'PENDING' && pathname !== '/pending-approval' && pathname !== '/login' && pathname !== '/register') {
        return NextResponse.redirect(new URL(withBasePath('/pending-approval'), request.url));
    }

    if (status === 'BANNED' && pathname !== '/banned' && pathname !== '/update-password') {
        return NextResponse.redirect(new URL(withBasePath('/banned'), request.url));
    }

    if (status === 'APPROVED' && (pathname === '/banned' || pathname === '/pending-approval')) {
        return NextResponse.redirect(new URL(withBasePath('/'), request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)'],
};
