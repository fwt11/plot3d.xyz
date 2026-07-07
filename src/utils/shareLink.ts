// Share link: encode FigureConfig to URL fragment, decode back.
// Pure client-side — no server round-trip. Per spec §3.5 Task 5.4.

import type { FigureConfig } from '@/types';

/** Maximum total URL length in bytes (spec: 8KB). */
export const SHARE_URL_LIMIT = 8192;

/**
 * Encode a figure to a share URL, or null if the encoded payload exceeds
 * SHARE_URL_LIMIT. This is a deliberate guard: oversized payloads return
 * null so the caller can warn the user, instead of emitting a broken link.
 */
export function encodeShareFigure(figure: FigureConfig): string | null {
  const json = JSON.stringify(figure);
  const base64 = base64UrlEncode(json);
  if (base64.length > SHARE_URL_LIMIT) return null;
  const base = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
  return `${base}#d=${base64}`;
}

/**
 * Decode a share URL back to a FigureConfig. Returns null if the URL has
 * no #d= fragment, the payload is malformed, or the decoded shape lacks a
 * `subplots` array.
 */
export function decodeShareFigure(url: string): FigureConfig | null {
  const fragment = parseShareHash(url);
  if (!fragment) return null;
  try {
    const parsed = JSON.parse(base64UrlDecode(fragment)) as FigureConfig;
    if (typeof parsed !== 'object' || parsed === null || !Array.isArray(parsed.subplots)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Parse a URL and return the value of the #d= fragment, or null if absent.
 */
export function parseShareHash(url: string): string | null {
  const hashIdx = url.indexOf('#d=');
  if (hashIdx === -1) return null;
  return url.substring(hashIdx + 3);
}

/** Encode a UTF-8 string to base64url (no padding). */
function base64UrlEncode(s: string): string {
  // Encode UTF-8 → base64
  const bytes = new TextEncoder().encode(s);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  // btoa is available in browser + jsdom (which we use for tests)
  const b64 = typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(s, 'utf-8').toString('base64');
  // Convert to URL-safe: + → -, / → _, remove = padding
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decode a base64url string to a UTF-8 string. */
function base64UrlDecode(s: string): string {
  // Convert from URL-safe back to standard base64
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  // Re-add padding
  while (b64.length % 4 !== 0) b64 += '=';
  const binary = typeof atob !== 'undefined' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  // Decode UTF-8
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
