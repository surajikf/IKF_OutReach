import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
    // 1. Refresh session via Supabase Middleware logic
    let response = await updateSession(request);
    
    // 2. Initialize Supabase for status/role checks
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll()
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
              response = NextResponse.next({
                request,
              })
              cookiesToSet.forEach(({ name, value, options }) =>
                response.cookies.set(name, value, options)
              )
            },
          },
        }
    );

    const { data: { user } } = await supabase.auth.getUser();
    const { pathname } = request.nextUrl;
    const withBasePath = (path: string) => `${request.nextUrl.basePath || ""}${path === "/" ? "" : path}` || "/";

    // Allow public access to APIs (API routes handle auth/authorization themselves),
    // Next.js internal routes, and static files.
    if (
        pathname.startsWith('/api') ||
        pathname.startsWith('/_next') ||
        pathname === '/favicon.ico' ||
        pathname.includes('.')
    ) {
        return response;
    }

    // Auth Routes logic
    const isAuthRoute = pathname === '/login' || pathname === '/register' || pathname === '/forgot-password';
    const metadata = user?.user_metadata || {};
    const status = metadata.status;
    const role = metadata.role;

    if (isAuthRoute) {
        if (user) {
            return NextResponse.redirect(new URL(withBasePath('/'), request.url));

        }
        return response;
    }

    // Protected Routes logic
    if (!user) {
        return NextResponse.redirect(new URL(withBasePath('/login'), request.url));
    }

    // Check Approval Status
    const isUpdatePasswordRoute = pathname === '/update-password';

    // Removed PENDING status check


    if (status === 'BANNED' && pathname !== '/banned' && !isUpdatePasswordRoute) {
        return NextResponse.redirect(new URL(withBasePath('/banned'), request.url));
    }

    // If approved, prevent access to banned
    if (status === 'APPROVED' && pathname === '/banned') {
        return NextResponse.redirect(new URL(withBasePath('/'), request.url));
    }

    // Admin Routes logic
    if (pathname.startsWith('/admin') && role !== 'ADMIN') {
        return NextResponse.redirect(new URL(withBasePath('/'), request.url));
    }

    return response;
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)'],
};
