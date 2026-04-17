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

    // 2. Auth Routes logic
    const isAuthRoute = pathname === '/login' || pathname === '/register' || pathname === '/forgot-password';
    
    if (isAuthRoute) {
        if (token) {
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

    // Redirect banned users (if we still use this logic, for now assuming role/status is in token)
    // Note: If status is needed, it should be added to the JWT token in callbacks
    const status = (token as any).status || 'APPROVED';
    
    if (status === 'BANNED' && pathname !== '/banned' && pathname !== '/update-password') {
        return NextResponse.redirect(new URL(withBasePath('/banned'), request.url));
    }

    if (status === 'APPROVED' && pathname === '/banned') {
        return NextResponse.redirect(new URL(withBasePath('/'), request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)'],
};
