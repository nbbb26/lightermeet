/**
 * API authentication and rate limiting middleware for LighterMeet
 * 
 * Uses LiveKit participant tokens for auth verification.
 * Provides rate limiting per IP/identity.
 */

import { NextRequest, NextResponse } from 'next/server';
import { TokenVerifier } from 'livekit-server-sdk';

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;

interface AuthResult {
  identity: string;
  roomName?: string;
}

/**
 * Verify a LiveKit participant token from the Authorization header.
 * Returns the identity and room if valid, or null if invalid.
 */
export async function verifyParticipantToken(req: NextRequest): Promise<AuthResult | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  if (!token || !API_KEY || !API_SECRET) {
    return null;
  }

  try {
    const verifier = new TokenVerifier(API_KEY, API_SECRET);
    const grants = await verifier.verify(token);
    if (!grants.sub) {
      return null;
    }
    return {
      identity: grants.sub,
      roomName: grants.video?.room ?? undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Simple in-memory rate limiter using sliding window.
 * Key: IP address or identity.
 */
interface RateLimitEntry {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupRateLimitStore(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  const cutoff = now - windowMs;
  for (const [key, entry] of rateLimitStore) {
    entry.timestamps = entry.timestamps.filter(t => t > cutoff);
    if (entry.timestamps.length === 0) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Check rate limit for a given key.
 * @param key - Rate limit key (IP, identity, etc.)
 * @param maxRequests - Maximum requests per window
 * @param windowMs - Window size in milliseconds
 * @returns true if allowed, false if rate limited
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): boolean {
  cleanupRateLimitStore(windowMs);
  const now = Date.now();
  const cutoff = now - windowMs;

  let entry = rateLimitStore.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    rateLimitStore.set(key, entry);
  }

  // Remove expired timestamps
  entry.timestamps = entry.timestamps.filter(t => t > cutoff);

  if (entry.timestamps.length >= maxRequests) {
    return false; // Rate limited
  }

  entry.timestamps.push(now);
  return true;
}

/**
 * Get client IP from request (behind proxy support)
 */
export function getClientIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

/**
 * Create an unauthorized response
 */
export function unauthorizedResponse(message = 'Authentication required'): NextResponse {
  return NextResponse.json(
    { error: message },
    { status: 401 }
  );
}

/**
 * Create a rate limited response
 */
export function rateLimitedResponse(): NextResponse {
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    { status: 429, headers: { 'Retry-After': '60' } }
  );
}
