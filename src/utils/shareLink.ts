// Share link: encode ChartConfig to URL fragment, decode back.
// Pure client-side — no server round-trip. Per spec §3.5 Task 5.4.

import type { ChartConfig } from '@/types';

/** Maximum total URL length in bytes (spec: 8KB). */
export const SHARE_URL_LIMIT = 8192;

/**
 * Encode a ChartConfig to a URL with the data in the #d= fragment.
 * Format: `<base>#d=<base64url(JSON.stringify(config))>`
 */
export function encodeShareUrl(config: ChartConfig): string {
  const json = JSON.stringify(config);
  // Use base64url (RFC 4648 §5) for URL-safe encoding
  const base64 = base64UrlEncode(json);
  return `${typeof window !== 'undefined' ? window.location.origin : ''}${typeof window !== 'undefined' ? window.location.pathname : ''}#d=${base64}`;
}

/**
 * Decode a share URL back to a ChartConfig.
 * Returns null if the URL has no #d= fragment or the data is malformed.
 */
export function decodeShareUrl(url: string): ChartConfig | null {
  const fragment = parseShareHash(url);
  if (!fragment) return null;
  try {
    const json = base64UrlDecode(fragment);
    const parsed = JSON.parse(json) as ChartConfig;
    // Basic shape check
    if (typeof parsed !== 'object' || parsed === null || !('type' in parsed)) return null;
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
