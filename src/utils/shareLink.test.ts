import { describe, it, expect } from 'vitest';
import { encodeShareFigure, decodeShareFigure, parseShareHash, SHARE_URL_LIMIT } from './shareLink';

describe('encodeShareFigure', () => {
  it('produces a URL with #d= fragment', () => {
    const fig = { rows: 1, cols: 1, activeIndex: 0, gap: 8, subplots: [{ id: 'c1', type: 'line' as const }] } as any;
    const url = encodeShareFigure(fig);
    expect(url).toMatch(/#d=/);
  });

  it('output is base64url-safe (no +/= chars)', () => {
    const fig = { rows: 1, cols: 1, activeIndex: 0, gap: 8, subplots: [{ id: 'c1', type: 'line' as const }] } as any;
    const url = encodeShareFigure(fig);
    const hash = parseShareHash(url!)!;
    expect(hash).not.toMatch(/[+/=]/);
  });

  it('returns null when the encoded figure exceeds the limit', () => {
    const big = { rows: 1, cols: 1, activeIndex: 0, gap: 8,
      subplots: [{ id: 'c', type: 'line', title: 'x'.repeat(SHARE_URL_LIMIT * 2) }] } as any;
    expect(encodeShareFigure(big)).toBeNull();
  });
});

describe('decodeShareFigure', () => {
  it('round-trips: encode then decode recovers the same figure', () => {
    const fig = { rows: 1, cols: 1, activeIndex: 0, gap: 8, subplots: [{ id: 'c1', type: 'line' as const, title: 'T' }] } as any;
    const url = encodeShareFigure(fig)!;
    const decoded = decodeShareFigure(url);
    expect(decoded).not.toBeNull();
    expect(decoded!.subplots[0].type).toBe('line');
    expect(decoded!.subplots[0].title).toBe('T');
  });

  it('returns null for URL without #d= fragment', () => {
    expect(decodeShareFigure('https://example.com/page')).toBeNull();
  });

  it('returns null for malformed base64 data', () => {
    expect(decodeShareFigure('https://example.com/#d=NOT_VALID_BASE64!!!')).toBeNull();
  });
});

describe('parseShareHash', () => {
  it('extracts the d= fragment value from a URL', () => {
    const fragment = parseShareHash('https://example.com/page#d=ABCD');
    expect(fragment).toBe('ABCD');
  });

  it('returns null when there is no d= fragment', () => {
    expect(parseShareHash('https://example.com/page')).toBeNull();
    expect(parseShareHash('https://example.com/page#other=foo')).toBeNull();
  });
});