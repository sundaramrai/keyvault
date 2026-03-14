import { NextRequest, NextResponse } from 'next/server';

/**
 * Edge-layer rate limiter — first line of defence.
 *
 * ⚠️  Limitation: the counter Map is in-process memory, so it resets on
 * every edge cold-start / new instance. On Vercel Edge this means limits
 * are per-instance, not globally enforced.
 *
 * This is intentionally a *secondary* guard alongside the backend's Redis-
 * backed slowapi rate limiter. For global enforcement replace the Map with
 * Vercel KV or Upstash Redis.
 */

const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
    '/api/auth/login': { max: 10, windowMs: 60_000 },
    '/api/auth/register': { max: 5, windowMs: 60_000 },
    '/api/auth/refresh': { max: 20, windowMs: 60_000 },
};

// ip:path → { count, resetAt }
const counters = new Map<string, { count: number; resetAt: number }>();

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const rule = RATE_LIMITS[pathname];
    if (!rule) return NextResponse.next();

    const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        request.headers.get('x-real-ip') ??
        'unknown';

    const key = `${ip}:${pathname}`;
    const now = Date.now();
    const entry = counters.get(key);

    if (!entry || now > entry.resetAt) {
        counters.set(key, { count: 1, resetAt: now + rule.windowMs });
        return NextResponse.next();
    }

    if (entry.count >= rule.max) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        return NextResponse.json(
            { error: `Rate limit exceeded. Try again in ${retryAfter}s.` },
            {
                status: 429,
                headers: {
                    'Retry-After': String(retryAfter),
                    'X-RateLimit-Limit': String(rule.max),
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
                },
            },
        );
    }

    entry.count += 1;
    return NextResponse.next();
}

export const config = {
    matcher: ['/api/auth/login', '/api/auth/register', '/api/auth/refresh'],
};
