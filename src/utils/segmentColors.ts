import { hexToHue } from './tracesBuilder';

/** Generate pie/polar segment colors derived from a base color.
 *  Returns an array of `count` color strings (hex or rgba depending on alpha). */
export function generateSegmentColors(count: number, alpha: number, baseColor?: string): string[] {
  const baseHue = baseColor ? hexToHue(baseColor) : 200;
  const baseHues = [0, 30, 150, 340, 60, 270, 100, 10, 180, 300];
  return Array.from({ length: count }, (_, i) => {
    const hue = (baseHue + baseHues[i % baseHues.length]) % 360;
    const s = 0.7, l = 0.55;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (hue < 60) { r = c; g = x; }
    else if (hue < 120) { r = x; g = c; }
    else if (hue < 180) { g = c; b = x; }
    else if (hue < 240) { g = x; b = c; }
    else if (hue < 300) { r = x; b = c; }
    else { r = c; b = x; }
    const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    return alpha < 1 ? `rgba(${Math.round((r + m) * 255)},${Math.round((g + m) * 255)},${Math.round((b + m) * 255)},${alpha})` : hex;
  });
}
