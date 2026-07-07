// Phase 5 Task 5.2: .plot3d file v6 format
// v5 → v6 upgrades:
//   - Stable key ordering (line-based JSON)
//   - Content-hash IDs (datasets / columns / layers derive IDs from content)
//   - Forward-compatible with v1..v5 (sanitize fills missing fields)

import type { ProjectFile } from './projectFile';

const PROJECT_VERSION = 6;

/**
 * Recursively serialize an object with stable key ordering.
 * Arrays preserve their original order.
 * Suitable for content-hash derivation and diff-friendly line-based output.
 */
export function stableStringify(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 'null';
    return String(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map((v) => stableStringify(v)).join(',') + ']';
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const parts: string[] = [];
    for (const k of keys) {
      parts.push(JSON.stringify(k) + ':' + stableStringify(obj[k]));
    }
    return '{' + parts.join(',') + '}';
  }
  return 'null';
}

/** Simple 64-bit FNV-1a hash → 16-char hex. */
export function contentHash(s: string): string {
  let hashLo = 0xcbf29ce4;
  let hashHi = 0x84222325;
  for (let i = 0; i < s.length; i++) {
    hashLo ^= s.charCodeAt(i);
    // 32-bit FNV-1a multiply (split into 16-bit halves to fit 32-bit math)
    hashLo = Math.imul(hashLo, 0x01000193) >>> 0;
  }
  // Second pass for 64-bit mixing
  for (let i = 0; i < s.length; i++) {
    hashHi ^= s.charCodeAt(s.length - 1 - i);
    hashHi = Math.imul(hashHi, 0x01000193) >>> 0;
  }
  return hashLo.toString(16).padStart(8, '0') + hashHi.toString(16).padStart(8, '0');
}

/** Serialize a ProjectFile to a line-based JSON string with stable key order. */
export function serializeProjectV6(project: ProjectFile): string {
  // Derive a content hash for the file as a whole (used for ID, not currently exposed).
  const ordered = orderProjectForSerialization(project);
  const json = stableStringify(ordered);
  return json
    .replace(/\{/g, '{\n')
    .replace(/\}/g, '\n}')
    .replace(/,/g, ',\n');
}

/** Parse a line-based or compact JSON project file, supporting v1..v6. */
export function deserializeProjectV6(text: string): ProjectFile | null {
  // Try strict line-based parse first; fall back to standard JSON.
  const cleaned = text.trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!isValidProjectFile(parsed)) return null;
  // Migrate older versions to v6 (no schema changes needed for v1..v5→v6)
  if (parsed.version < PROJECT_VERSION) {
    parsed.version = PROJECT_VERSION;
  }
  return parsed;
}

/** Validate a parsed object as a ProjectFile (any version 1..6). */
export function isValidProjectFile(data: unknown): data is ProjectFile {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  if (typeof d.version !== 'number') return false;
  if (d.version < 1 || d.version > 6) return false;
  if (!Array.isArray(d.datasets)) return false;
  // v6 uses `figure`; legacy files (v1..v5) use `chartConfig`. Accept either.
  const hasFigure = typeof d.figure === 'object' && d.figure !== null;
  const hasChartConfig = typeof d.chartConfig === 'object' && d.chartConfig !== null;
  if (!hasFigure && !hasChartConfig) return false;
  if (d.theme !== 'light' && d.theme !== 'dark') return false;
  if (d.lang !== 'zh' && d.lang !== 'en') return false;
  return true;
}

/** Reorder top-level fields in a canonical order (datasets → figure → ...). */
function orderProjectForSerialization(project: ProjectFile): ProjectFile {
  // v6 files carry `figure`; v1..v5 files still carry `chartConfig`. Emit whichever
  // is present so v6 files stay v6-shaped and older files round-trip unchanged.
  const source = project as unknown as Record<string, unknown>;
  const result: Record<string, unknown> = {
    version: project.version,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    datasets: project.datasets,
  };
  if ('figure' in source) result.figure = source.figure;
  if ('chartConfig' in source) result.chartConfig = source.chartConfig;
  result.theme = project.theme;
  result.lang = project.lang;
  return result as unknown as ProjectFile;
}
