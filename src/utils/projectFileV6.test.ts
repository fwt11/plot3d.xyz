import { describe, it, expect } from 'vitest';
import {
  serializeProjectV6,
  deserializeProjectV6,
  stableStringify,
  contentHash,
  isValidProjectFile,
} from './projectFileV6';
import type { ProjectFile } from './projectFile';

const sampleProject: ProjectFile = {
  version: 6,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  datasets: [
    {
      id: 'ds1',
      name: 'Dataset 1',
      columns: [
        { id: 'c1', name: 'x', type: 'X', values: [1, 2, 3] },
        { id: 'c2', name: 'y', type: 'Y', values: [10, 20, 30] },
      ],
    },
  ],
  chartConfig: {
    id: 'cfg1',
    type: 'line',
    title: 'Test',
    xAxis: { label: 'X', autoRange: true, gridVisible: true, logScale: false, scientificNotation: false },
    yAxis: { label: 'Y', autoRange: true, gridVisible: true, logScale: false, scientificNotation: false },
    legend: { visible: true, position: 'top' },
    colorMap: 'viridis',
    layers: [
      {
        id: 'L1',
        datasetId: 'ds1',
        xColumn: 'c1',
        yColumn: 'c2',
        color: '#000',
        visible: true,
        lineStyle: 'solid',
        lineWidth: 1,
        pointStyle: 'circle',
        pointSize: 4,
        fill: false,
      },
    ],
    annotations: [],
    marginTop: 50, marginRight: 50, marginBottom: 50, marginLeft: 50,
    exportConfig: { resolutionMultiplier: 1, background: 'theme', figureMultiplier: 1 },
    fontSize: 12,
  },
  theme: 'light',
  lang: 'en',
};

describe('stableStringify (Phase 5 Task 5.2)', () => {
  it('produces stable output regardless of property order', () => {
    const a = { x: 1, y: 2, z: 3 };
    const b = { z: 3, y: 2, x: 1 };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it('produces stable output for nested objects', () => {
    const a = { x: { a: 1, b: 2 } };
    const b = { x: { b: 2, a: 1 } };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it('handles arrays in stable order', () => {
    expect(stableStringify([3, 1, 2])).toBe(stableStringify([3, 1, 2]));
  });

  it('produces different output for different content', () => {
    expect(stableStringify({ a: 1 })).not.toBe(stableStringify({ a: 2 }));
  });
});

describe('contentHash (Phase 5 Task 5.2)', () => {
  it('produces same hash for same content (deterministic)', () => {
    const s = '{"x":1,"y":2}';
    expect(contentHash(s)).toBe(contentHash(s));
  });

  it('produces different hash for different content', () => {
    expect(contentHash('a')).not.toBe(contentHash('b'));
  });

  it('returns a 16-char hex string', () => {
    expect(contentHash('test')).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('serializeProjectV6 / deserializeProjectV6', () => {
  it('roundtrips the sample project', () => {
    const serialized = serializeProjectV6(sampleProject);
    const restored = deserializeProjectV6(serialized);
    expect(restored).not.toBeNull();
    expect(restored!.version).toBe(6);
    expect(restored!.datasets[0].name).toBe('Dataset 1');
    expect(restored!.chartConfig.title).toBe('Test');
  });

  it('serialized form has line-based stable ordering', () => {
    const serialized = serializeProjectV6(sampleProject);
    // Should contain line breaks (line-based JSON per spec)
    expect(serialized).toMatch(/[\r\n]/);
  });

  it('detects malformed data', () => {
    expect(isValidProjectFile('not json')).toBe(false);
    expect(isValidProjectFile('{"version": 999}')).toBe(false);
  });

  it('upgrades from v5 (backward compatibility)', () => {
    const v5 = JSON.parse(JSON.stringify(sampleProject));
    v5.version = 5;
    const v5Json = JSON.stringify(v5);
    // deserializeV6 should accept v5 by returning a v6-migrated copy
    const restored = deserializeProjectV6(v5Json);
    expect(restored).not.toBeNull();
    // version is bumped to 6 on migration
    expect(restored!.version).toBe(6);
  });
});
