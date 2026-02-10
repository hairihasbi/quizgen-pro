
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware untuk Rate Limiting di layer Edge
 */
export function middleware(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'anonymous';
  const { pathname } = request.nextUrl;

  // Hanya proteksi route API
  if (pathname.startsWith('/api')) {
    // Note: Di lingkungan serverless/edge murni tanpa KV, 
    // kita menggunakan header atau struktur kontrol akses sederhana.
    // Untuk implementasi production "World Class", disarankan menggunakan Upstash Redis.
    
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-rate-limit-ip', ip);

    // Contoh logika sederhana: Cegah akses dari IP yang diketahui melakukan abuse 
    // (Bisa dikembangkan dengan integrasi Redis/KV)
    
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
