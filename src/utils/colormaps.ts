import type { ColorMapName } from '@/types';

type ColorMap = Record<ColorMapName, string[]>;

export const colorMaps: ColorMap = {
  jet: [
    '#000083', '#0000FF', '#007FFF', '#00FFFF', '#7FFF7F',
    '#FFFF00', '#FF7F00', '#FF0000', '#830000',
  ],
  viridis: [
    '#440154', '#482777', '#3F4A8A', '#31678E', '#26838F',
    '#1F9D8A', '#6CCE59', '#B6DE2B', '#FEE825',
  ],
  hot: [
    '#000000', '#B30000', '#E60000', '#FF2200', '#FF5500',
    '#FF8800', '#FFBB00', '#FFEE00', '#FFFF66',
  ],
  coolwarm: [
    '#3B4CC0', '#6788EE', '#9ABBFF', '#C9D7F0', '#EDD1C2',
    '#F0B99C', '#E1946A', '#C46A38', '#8B3A06',
  ],
  parula: [
    '#352A87', '#3753B3', '#4476C4', '#5C99C2', '#7BB8A9',
    '#9DD28F', '#BDE463', '#D9E838', '#F5D802',
  ],
  plasma: [
    '#0D0887', '#46039F', '#7201A8', '#9C179E', '#BD3786',
    '#D8576B', '#ED7953', '#FB9F3A', '#F0F921',
  ],
};

export function getColorFromMap(value: number, mapName: ColorMapName): string {
  const map = colorMaps[mapName];
  const clamped = Math.max(0, Math.min(1, value));
  const idx = clamped * (map.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.min(lower + 1, map.length - 1);
  const t = idx - lower;

  const c1 = hexToRgb(map[lower]);
  const c2 = hexToRgb(map[upper]);

  const r = Math.round(c1.r + (c2.r - c1.r) * t);
  const g = Math.round(c1.g + (c2.g - c1.g) * t);
  const b = Math.round(c1.b + (c2.b - c1.b) * t);

  return `rgb(${r},${g},${b})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

export function getColorMapGradient(mapName: ColorMapName): string {
  const map = colorMaps[mapName];
  const stops = map.map((color, i) => `${color} ${(i / (map.length - 1)) * 100}%`);
  return `linear-gradient(to right, ${stops.join(', ')})`;
}
