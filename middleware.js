import { NextResponse } from 'next/server';

function configuredUrl() {
  const value = String(process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  if (!value) return null;
  try { return new URL(value); } catch { return null; }
}

function externalOrigin(request) {
  const configured = configuredUrl();
  if (configured) return configured.origin;
  if (process.env.TRUST_PROXY !== '1') return request.nextUrl.origin;
  const host = String(request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host)
    .split(',')[0].trim();
  const proto = String(request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', ''))
    .split(',')[0].trim();
  try { return new URL(`${proto}://${host}`).origin; } catch { return request.nextUrl.origin; }
}

function isProtected(pathname) {
  return pathname === '/admin' || pathname.startsWith('/admin/') ||
    pathname === '/account' || pathname.startsWith('/account/') ||
    pathname === '/favorites' || pathname.startsWith('/favorites/') ||
    pathname.startsWith('/api/admin/') || pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/user/');
}

function addSecurityHeaders(response, request) {
  const { pathname } = request.nextUrl;
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Content-Security-Policy', "frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  if (isProtected(pathname)) {
    response.headers.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.append('Vary', 'Cookie');
  }
  if (externalOrigin(request).startsWith('https://')) {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000');
  }
  return response;
}

export function middleware(request) {
  const { pathname, search } = request.nextUrl;
  const configured = configuredUrl();
  const safeNavigation = request.method === 'GET' || request.method === 'HEAD';
  const observedHost = String(
    process.env.TRUST_PROXY === '1'
      ? request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host
      : request.headers.get('host') || request.nextUrl.host,
  ).split(',')[0].trim();

  // 只统一浏览器页面的主机名。协议由 Nginx 的 X-Forwarded-Proto 与 SITE_URL 决定，
  // 避免上游 HTTP、外部 HTTPS 的常见部署方式出现自重定向循环。
  if (configured && safeNavigation && !pathname.startsWith('/api/') && observedHost !== configured.host) {
    return addSecurityHeaders(
      NextResponse.redirect(new URL(`${pathname}${search}`, configured.origin), 308),
      request,
    );
  }
  if (!configured && safeNavigation && !pathname.startsWith('/api/') &&
      ['127.0.0.1', '[::1]', '::1'].includes(request.nextUrl.hostname)) {
    const destination = request.nextUrl.clone();
    destination.hostname = 'localhost';
    return addSecurityHeaders(NextResponse.redirect(destination, 308), request);
  }

  if (!safeNavigation && pathname.startsWith('/api/')) {
    const fetchSite = String(request.headers.get('sec-fetch-site') || '').toLowerCase();
    const origin = request.headers.get('origin');
    let originAllowed = true;
    if (fetchSite === 'cross-site') originAllowed = false;
    if (origin) {
      try { originAllowed = originAllowed && new URL(origin).origin === externalOrigin(request); }
      catch { originAllowed = false; }
    }
    if (!originAllowed) {
      return addSecurityHeaders(
        NextResponse.json({ error: 'forbidden', message: '拒绝跨站请求' }, { status: 403 }),
        request,
      );
    }
  }

  return addSecurityHeaders(NextResponse.next(), request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
