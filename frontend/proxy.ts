import { NextRequest, NextResponse } from 'next/server';

/**
 * Pass-through proxy hook.
 *
 * Authoritative rate limiting is enforced by the backend's Redis-backed
 * slowapi limiter. We intentionally avoid duplicating an in-memory limiter
 * here because it would only be per-instance and could drift from backend
 * policy.
 */
export function proxy(_request: NextRequest) {
    return NextResponse.next();
}

export const config = {
    matcher: ['/api/auth/login', '/api/auth/register', '/api/auth/refresh'],
};
