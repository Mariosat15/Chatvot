import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/api/auth/login'];

// API routes that need their own auth handling
const API_ROUTES_PREFIX = '/api/';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow API routes to handle their own authentication
  // (they'll return 401 if unauthorized)
  if (pathname.startsWith(API_ROUTES_PREFIX)) {
    return NextResponse.next();
  }

  // Check for admin token
  const token = request.cookies.get('admin_token')?.value;

  if (!token) {
    // No token - redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verify JWT token
  try {
    const secret = new TextEncoder().encode(
      process.env.ADMIN_JWT_SECRET || 'your-super-secret-admin-key-change-in-production'
    );
    
    await jwtVerify(token, secret);
    
    // Token is valid - allow access
    return NextResponse.next();
  } catch (error) {
    // Invalid token - clear cookie and redirect to login
    console.error('Invalid admin token:', error);
    
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('admin_token');
    return response;
  }
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|assets/).*)',
  ],
};

