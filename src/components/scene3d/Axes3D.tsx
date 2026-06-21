import { Line, Text } from '@react-three/drei';
import { useMemo } from 'react';
import type { DataRange } from './types';
import { niceScale } from './types';

/** Read a CSS variable value with fallback */
function getCSSVar(varName: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallback;
}

export function Axes3D({ range }: { range: DataRange }) {
  const size = 1.2;
  const xTicks = niceScale(range.xMin, range.xMax);
  const yTicks = niceScale(range.yMin, range.yMax);
  const zTicks = niceScale(range.zMin, range.zMax);

  const toNorm = (val: number, min: number, max: number) => ((val - min) / (max - min || 1)) * 2 - 1;

  // Theme-aware axis colors via CSS variables with fallbacks
  const axisColors = useMemo(() => ({
    x: getCSSVar('--axis-x-color', '#f97316'),  // orange
    y: getCSSVar('--axis-y-color', '#22c55e'),  // green  (data Y, depth direction)
    z: getCSSVar('--axis-z-color', '#3b82f6'),  // blue   (data Z, vertical direction)
  }), []);

  // Outline props for better text readability
  const textOutline = { outlineWidth: 2, outlineColor: '#000000' };

  return (
    <group>
      {/* Axis lines */}
      {/* X axis (horizontal, data X) - orange */}
      <Line points={[[-size, -1, -size], [size, -1, -size]]} color={axisColors.x} lineWidth={1.5} />
      {/* Z axis (vertical, data Z) - blue */}
      <Line points={[[-size, -1, -size], [-size, size, -size]]} color={axisColors.z} lineWidth={1.5} />
      {/* Y axis (depth, data Y) - green */}
      <Line points={[[-size, -1, -size], [-size, -1, size]]} color={axisColors.y} lineWidth={1.5} />

      {/* X ticks and labels (horizontal, data X) */}
      {xTicks.map((v) => {
        const x = toNorm(v, range.xMin, range.xMax);
        if (x < -1 || x > 1) return null;
        return (
          <group key={`xt-${v}`}>
            <Line points={[[x, -1, -size], [x, -1.05, -size]]} color={axisColors.x} lineWidth={1} />
            <Text position={[x, -1.18, -size]} fontSize={0.08} color="#a1a1aa" anchorX="center" anchorY="top" {...textOutline}>
              {v.toFixed(v === Math.round(v) ? 0 : 1)}
            </Text>
          </group>
        );
      })}
      {/* X axis label */}
      <Text position={[0, -1.35, -size]} fontSize={0.1} color={axisColors.x} anchorX="center" {...textOutline}>
        {range.xLabel}
      </Text>

      {/* Z ticks and labels (vertical, data Z) */}
      {zTicks.map((v) => {
        const y = toNorm(v, range.zMin, range.zMax);
        if (y < -1 || y > 1) return null;
        return (
          <group key={`zt-${v}`}>
            <Line points={[[-size, y, -size], [-size - 0.05, y, -size]]} color={axisColors.z} lineWidth={1} />
            <Text position={[-size - 0.12, y, -size]} fontSize={0.08} color="#a1a1aa" anchorX="right" anchorY="middle" {...textOutline}>
              {v.toFixed(v === Math.round(v) ? 0 : 1)}
            </Text>
          </group>
        );
      })}
      {/* Z axis label (vertical) */}
      <Text position={[-size - 0.3, 0, -size]} fontSize={0.1} color={axisColors.z} anchorX="center" rotation={[0, 0, Math.PI / 2]} {...textOutline}>
        {range.zLabel}
      </Text>

      {/* Y ticks and labels (depth, data Y) */}
      {yTicks.map((v) => {
        const z = toNorm(v, range.yMin, range.yMax);
        if (z < -1 || z > 1) return null;
        return (
          <group key={`yt-${v}`}>
            <Line points={[[-size, -1, z], [-size, -1.05, z]]} color={axisColors.y} lineWidth={1} />
            <Text position={[-size, -1.18, z]} fontSize={0.08} color="#a1a1aa" anchorX="right" anchorY="top" {...textOutline}>
              {v.toFixed(v === Math.round(v) ? 0 : 1)}
            </Text>
          </group>
        );
      })}
      {/* Y axis label (depth) */}
      <Text position={[-size, -1.35, 0]} fontSize={0.1} color={axisColors.y} anchorX="center" {...textOutline}>
        {range.yLabel}
      </Text>

      {/* Grid on floor (XZ plane at y=-1) */}
      {xTicks.map((v) => {
        const x = toNorm(v, range.xMin, range.xMax);
        if (x < -1 || x > 1) return null;
        return <Line key={`gx-${v}`} points={[[x, -1, -size], [x, -1, size]]} color="#52525b" lineWidth={1} transparent opacity={0.6} />;
      })}
      {yTicks.map((v) => {
        const z = toNorm(v, range.yMin, range.yMax);
        if (z < -1 || z > 1) return null;
        return <Line key={`gz-${v}`} points={[[-size, -1, z], [size, -1, z]]} color="#52525b" lineWidth={1} transparent opacity={0.6} />;
      })}

      {/* Back wall grid (XY plane at z=-size) */}
      {xTicks.map((v) => {
        const x = toNorm(v, range.xMin, range.xMax);
        if (x < -1 || x > 1) return null;
        return <Line key={`bwx-${v}`} points={[[x, -1, -size], [x, size, -size]]} color="#52525b" lineWidth={1} transparent opacity={0.3} />;
      })}
      {zTicks.map((v) => {
        const y = toNorm(v, range.zMin, range.zMax);
        if (y < -1 || y > 1) return null;
        return <Line key={`bwz-${v}`} points={[[-size, y, -size], [size, y, -size]]} color="#52525b" lineWidth={1} transparent opacity={0.3} />;
      })}

      {/* Side wall grid (YZ plane at x=-size) */}
      {yTicks.map((v) => {
        const z = toNorm(v, range.yMin, range.yMax);
        if (z < -1 || z > 1) return null;
        return <Line key={`swy-${v}`} points={[[-size, -1, z], [-size, size, z]]} color="#52525b" lineWidth={1} transparent opacity={0.3} />;
      })}
      {zTicks.map((v) => {
        const y = toNorm(v, range.zMin, range.zMax);
        if (y < -1 || y > 1) return null;
        return <Line key={`swz-${v}`} points={[[-size, y, -size], [-size, y, size]]} color="#52525b" lineWidth={1} transparent opacity={0.3} />;
      })}
    </group>
  );
}
