export interface AxisRanges {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** Read current 2D axis ranges from a rendered Plotly div. */
export function readAxisRanges(plotDiv: HTMLElement | null): AxisRanges | null {
  if (!plotDiv) return null;
  try {
    const fullLayout = (plotDiv as unknown as { _fullLayout?: { xaxis?: { range?: [number, number] }; yaxis?: { range?: [number, number] } } })._fullLayout;
    const xaxis = fullLayout?.xaxis;
    const yaxis = fullLayout?.yaxis;
    if (!xaxis?.range || !yaxis?.range) return null;
    return { xMin: xaxis.range[0], xMax: xaxis.range[1], yMin: yaxis.range[0], yMax: yaxis.range[1] };
  } catch {
    return null;
  }
}

/** Convert a percent value (0-100) to a data value using an axis range. */
export function percentToData(percent: number, min: number, max: number): number {
  if (max === min) return min;
  return min + (percent / 100) * (max - min);
}

/** Convert a data value to a percent value (0-100) using an axis range. */
export function dataToPercent(value: number, min: number, max: number): number {
  if (max === min) return 50;
  return ((value - min) / (max - min)) * 100;
}

/** Clamp a percent value to [0, 100]. */
export function clampPercent(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/** Convert a mouse position (clientX/clientY) to percent coordinates within a container. */
export function clientToPercent(
  clientX: number,
  clientY: number,
  rect: DOMRect
): { x: number; y: number } {
  return {
    x: clampPercent(((clientX - rect.left) / rect.width) * 100),
    y: clampPercent(((clientY - rect.top) / rect.height) * 100),
  };
}

/** Convert stored annotation coordinates to display percent. */
export function toDisplayPercent(
  x: number,
  y: number,
  coordMode: 'percent' | 'data',
  axisRanges: AxisRanges | null
): { x: number; y: number } {
  if (coordMode === 'percent' || !axisRanges) return { x, y };
  return {
    x: dataToPercent(x, axisRanges.xMin, axisRanges.xMax),
    // Invert Y because CSS percent coordinates grow downward while Plotly Y axis grows upward.
    y: 100 - dataToPercent(y, axisRanges.yMin, axisRanges.yMax),
  };
}

/** Rotate a point (px,py) around a center (cx,cy) by angleDeg degrees. */
export function rotatePoint(
  px: number,
  py: number,
  cx: number,
  cy: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = px - cx;
  const dy = py - cy;
  return {
    x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

/**
 * Rotate a point in percent coordinates while compensating for container aspect ratio.
 * Percent coords are non-isometric (1% x != 1% y when width != height), so naive rotation
 * distorts angles. This normalizes to an isometric pixel space, rotates, then converts back.
 */
export function rotatePointIsometric(
  px: number,
  py: number,
  cx: number,
  cy: number,
  angleDeg: number,
  aspectRatio: number, // width / height
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  // Normalize to isometric space: scale x by aspectRatio so 1 unit = 1 pixel-height
  const dx = (px - cx) * aspectRatio;
  const dy = py - cy;
  // Rotate in isometric space
  const dxR = dx * Math.cos(rad) - dy * Math.sin(rad);
  const dyR = dx * Math.sin(rad) + dy * Math.cos(rad);
  // Convert back to percent space
  return {
    x: cx + dxR / aspectRatio,
    y: cy + dyR,
  };
}

/** Convert a mouse percent to stored coordinates based on coordMode. */
export function toStoredCoords(
  x: number,
  y: number,
  coordMode: 'percent' | 'data',
  axisRanges: AxisRanges | null
): { x: number; y: number } {
  const clamped = { x: clampPercent(x), y: clampPercent(y) };
  if (coordMode === 'percent' || !axisRanges) return clamped;
  return {
    x: percentToData(clamped.x, axisRanges.xMin, axisRanges.xMax),
    // Invert Y because CSS percent coordinates grow downward while Plotly Y axis grows upward.
    y: percentToData(100 - clamped.y, axisRanges.yMin, axisRanges.yMax),
  };
}
