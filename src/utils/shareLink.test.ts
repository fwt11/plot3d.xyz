import { describe, it, expect } from 'vitest';
import type { ChartConfig, FigureConfig } from '@/types';
import { encodeShareFigure, decodeShareFigure, parseShareHash, SHARE_URL_LIMIT } from './shareLink';

// Build a minimal FigureConfig from a partial ChartConfig: the encoder only
// JSON-stringifies the shape, so full axis/legend defaults are not needed.
function makeFigure(subplot: Partial<ChartConfig> & Pick<ChartConfig, 'id' | 'type'>): FigureConfig {
  return { rows: 1, cols: 1, activeIndex: 0, gap: 8, subplots: [subplot as ChartConfig] };
}

describe('encodeShareFigure', () => {
  it('produces a URL with #d= fragment', () => {
    const url = encodeShareFigure(makeFigure({ id: 'c1', type: 'line' }));
    expect(url).toMatch(/#d=/);
  });

  it('output is base64url-safe (no +/= chars)', () => {
    const url = encodeShareFigure(makeFigure({ id: 'c1', type: 'line' }));
    const hash = parseShareHash(url!)!;
    expect(hash).not.toMatch(/[+/=]/);
  });

  it('returns null when the encoded figure exceeds the limit', () => {
    const big = makeFigure({ id: 'c', type: 'line', title: 'x'.repeat(SHARE_URL_LIMIT * 2) });
    expect(encodeShareFigure(big)).toBeNull();
  });
});

describe('decodeShareFigure', () => {
  it('round-trips: encode then decode recovers the same figure', () => {
    const url = encodeShareFigure(makeFigure({ id: 'c1', type: 'line', title: 'T' }))!;
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