import { describe, it, expect } from 'vitest';
import { encodeShareUrl, decodeShareUrl, parseShareHash, SHARE_URL_LIMIT } from './shareLink';
import type { ChartConfig } from '@/types';

const baseConfig: ChartConfig = {
  id: 'c1',
  type: 'line',
  title: 'Test Chart',
  xAxis: { label: 'X', unit: 's', autoRange: true, gridVisible: true, logScale: false, scientificNotation: false },
  yAxis: { label: 'Y', autoRange: true, gridVisible: true, logScale: false, scientificNotation: false },
  legend: { visible: true, position: 'top' },
  colorMap: 'viridis',
  layers: [],
  annotations: [],
  marginTop: 50, marginRight: 50, marginBottom: 50, marginLeft: 50,
  exportConfig: { resolutionMultiplier: 1, background: 'theme', figureMultiplier: 1 },
  fontSize: 12,
};

describe('encodeShareUrl', () => {
  it('produces a URL with #d= fragment', () => {
    const url = encodeShareUrl(baseConfig);
    expect(url).toMatch(/#d=/);
  });

  it('output is base64url-safe (no +/= chars)', () => {
    const url = encodeShareUrl(baseConfig);
    const hash = parseShareHash(url)!;
    // base64url uses - and _ instead of + and /, and omits padding
    expect(hash).not.toMatch(/[+/=]/);
  });

  it('output length fits under 8KB for typical config', () => {
    const url = encodeShareUrl(baseConfig);
    expect(url.length).toBeLessThan(SHARE_URL_LIMIT);
  });
});

describe('decodeShareUrl', () => {
  it('roundtrips: encode then decode recovers the same config (modulo id)', () => {
    const url = encodeShareUrl(baseConfig);
    const decoded = decodeShareUrl(url);
    expect(decoded).not.toBeNull();
    expect(decoded!.type).toBe(baseConfig.type);
    expect(decoded!.title).toBe(baseConfig.title);
    expect(decoded!.xAxis.label).toBe(baseConfig.xAxis.label);
  });

  it('returns null for URL without #d= fragment', () => {
    expect(decodeShareUrl('https://example.com/page')).toBeNull();
  });

  it('returns null for malformed base64 data', () => {
    expect(decodeShareUrl('https://example.com/#d=NOT_VALID_BASE64!!!')).toBeNull();
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
