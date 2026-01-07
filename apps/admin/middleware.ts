import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login', 
  '/api/auth/login',
  '/api/auth/logout'
];

// API routes prefix
const API_ROUTES_PREFIX = '/api/';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes (login page and auth endpoints)
  if (PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Get admin token from cookie or Authorization header
  const tokenFromCookie = request.cookies.get('admin_token')?.value;
  const authHeader = request.headers.get('authorization');
  const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = tokenFromCookie || tokenFromHeader;

  // For API routes - return 401 JSON response if unauthorized
  if (pathname.startsWith(API_ROUTES_PREFIX)) {
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin authentication required' }, 
        { status: 401 }
      );
    }

    // Verify JWT token for API routes
    try {
      const secret = new TextEncoder().encode(
        process.env.ADMIN_JWT_SECRET || 'your-super-secret-admin-key-change-in-production'
      );
      
      await jwtVerify(token, secret);
      return NextResponse.next();
    } catch (error) {
      console.error('Invalid admin token for API route:', error);
      return NextResponse.json(
        { error: 'Unauthorized - Invalid or expired token' }, 
        { status: 401 }
      );
    }
  }

  // For page routes - redirect to login if no token
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verify JWT token for page routes
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

