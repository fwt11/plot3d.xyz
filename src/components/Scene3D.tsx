import { useRef, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Line } from '@react-three/drei';
import { usePlotStore } from '@/store/plotStore';
import { getColorFromMap, getColorMapGradient } from '@/utils/colormaps';
import * as THREE from 'three';

interface DataRange {
  xMin: number; xMax: number; xLabel: string;
  yMin: number; yMax: number; yLabel: string;
  zMin: number; zMax: number; zLabel: string;
}

function useDataRange(): DataRange | null {
  const datasets = usePlotStore((s) => s.datasets);
  const chartConfig = usePlotStore((s) => s.chartConfig);

  return useMemo(() => {
    const layer = chartConfig.layers[0];
    if (!layer) return null;
    const ds = datasets.find((d) => d.id === layer.datasetId);
    if (!ds) return null;
    const xCol = ds.columns.find((c) => c.id === layer.xColumn);
    const yCol = ds.columns.find((c) => c.id === layer.yColumn);
    const zCol = ds.columns.find((c) => c.id === layer.zColumn);
    if (!xCol || !yCol || !zCol) return null;

    const xVals = xCol.values.map(Number);
    const yVals = yCol.values.map(Number);
    const zVals = zCol.values.map(Number);

    return {
      xMin: Math.min(...xVals), xMax: Math.max(...xVals), xLabel: chartConfig.xAxis.label || xCol.name,
      yMin: Math.min(...yVals), yMax: Math.max(...yVals), yLabel: chartConfig.yAxis.label || yCol.name,
      zMin: Math.min(...zVals), zMax: Math.max(...zVals), zLabel: chartConfig.zAxis?.label || zCol.name,
    };
  }, [datasets, chartConfig]);
}

function niceScale(min: number, max: number, ticks = 5): number[] {
  const range = max - min || 1;
  const step = Math.pow(10, Math.floor(Math.log10(range / ticks)));
  const niceStep = step * (range / step / ticks > 5 ? 2 : range / step / ticks > 2 ? 1 : 0.5);
  const start = Math.ceil(min / niceStep) * niceStep;
  const values: number[] = [];
  for (let v = start; v <= max + niceStep * 0.01; v += niceStep) {
    values.push(parseFloat(v.toFixed(4)));
  }
  return values;
}

function Axes3D({ range }: { range: DataRange }) {
  const size = 1.2;
  const xTicks = niceScale(range.xMin, range.xMax);
  const yTicks = niceScale(range.yMin, range.yMax);
  const zTicks = niceScale(range.zMin, range.zMax);

  const toNorm = (val: number, min: number, max: number) => ((val - min) / (max - min || 1)) * 2 - 1;

  return (
    <group>
      {/* Axis lines */}
      {/* X axis (red) */}
      <Line points={[[-size, -1, -size], [size, -1, -size]]} color="#f97316" lineWidth={1.5} />
      {/* Y axis (green) - vertical */}
      <Line points={[[-size, -1, -size], [-size, size, -size]]} color="#22c55e" lineWidth={1.5} />
      {/* Z axis (blue) - depth */}
      <Line points={[[-size, -1, -size], [-size, -1, size]]} color="#3b82f6" lineWidth={1.5} />

      {/* X ticks and labels */}
      {xTicks.map((v) => {
        const x = toNorm(v, range.xMin, range.xMax);
        if (x < -1 || x > 1) return null;
        return (
          <group key={`xt-${v}`}>
            <Line points={[[x, -1, -size], [x, -1.05, -size]]} color="#f97316" lineWidth={1} />
            <Text position={[x, -1.18, -size]} fontSize={0.08} color="#a1a1aa" anchorX="center" anchorY="top">
              {v.toFixed(v === Math.round(v) ? 0 : 1)}
            </Text>
          </group>
        );
      })}
      {/* X axis label */}
      <Text position={[0, -1.35, -size]} fontSize={0.1} color="#f97316" anchorX="center">
        {range.xLabel}
      </Text>

      {/* Y ticks and labels (vertical) */}
      {zTicks.map((v) => {
        const y = toNorm(v, range.zMin, range.zMax);
        if (y < -1 || y > 1) return null;
        return (
          <group key={`yt-${v}`}>
            <Line points={[[-size, y, -size], [-size - 0.05, y, -size]]} color="#22c55e" lineWidth={1} />
            <Text position={[-size - 0.12, y, -size]} fontSize={0.08} color="#a1a1aa" anchorX="right" anchorY="middle">
              {v.toFixed(v === Math.round(v) ? 0 : 1)}
            </Text>
          </group>
        );
      })}
      {/* Y axis label */}
      <Text position={[-size - 0.3, 0, -size]} fontSize={0.1} color="#22c55e" anchorX="center" rotation={[0, 0, Math.PI / 2]}>
        {range.zLabel}
      </Text>

      {/* Z ticks and labels (depth) */}
      {yTicks.map((v) => {
        const z = toNorm(v, range.yMin, range.yMax);
        if (z < -1 || z > 1) return null;
        return (
          <group key={`zt-${v}`}>
            <Line points={[[-size, -1, z], [-size, -1.05, z]]} color="#3b82f6" lineWidth={1} />
            <Text position={[-size, -1.18, z]} fontSize={0.08} color="#a1a1aa" anchorX="right" anchorY="top">
              {v.toFixed(v === Math.round(v) ? 0 : 1)}
            </Text>
          </group>
        );
      })}
      {/* Z axis label */}
      <Text position={[-size, -1.35, 0]} fontSize={0.1} color="#3b82f6" anchorX="center">
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
        return <Line key={`bwy-${v}`} points={[[-size, y, -size], [size, y, -size]]} color="#52525b" lineWidth={1} transparent opacity={0.3} />;
      })}

      {/* Side wall grid (YZ plane at x=-size) */}
      {yTicks.map((v) => {
        const z = toNorm(v, range.yMin, range.yMax);
        if (z < -1 || z > 1) return null;
        return <Line key={`swz-${v}`} points={[[-size, -1, z], [-size, size, z]]} color="#52525b" lineWidth={1} transparent opacity={0.3} />;
      })}
      {zTicks.map((v) => {
        const y = toNorm(v, range.zMin, range.zMax);
        if (y < -1 || y > 1) return null;
        return <Line key={`swy-${v}`} points={[[-size, y, -size], [-size, y, size]]} color="#52525b" lineWidth={1} transparent opacity={0.3} />;
      })}
    </group>
  );
}

function SurfaceMesh() {
  const datasets = usePlotStore((s) => s.datasets);
  const chartConfig = usePlotStore((s) => s.chartConfig);
  const scene3D = usePlotStore((s) => s.scene3D);

  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    const layer = chartConfig.layers[0];
    if (!layer) return new THREE.BufferGeometry();

    const ds = datasets.find((d) => d.id === layer.datasetId);
    if (!ds) return new THREE.BufferGeometry();

    const xCol = ds.columns.find((c) => c.id === layer.xColumn);
    const yCol = ds.columns.find((c) => c.id === layer.yColumn);
    const zCol = ds.columns.find((c) => c.id === layer.zColumn);

    if (!xCol || !yCol || !zCol) return new THREE.BufferGeometry();

    const xVals = xCol.values.map(Number);
    const yVals = yCol.values.map(Number);
    const zVals = zCol.values.map(Number);

    const uniqueX = [...new Set(xVals.map((v) => parseFloat(v.toFixed(4))))].sort((a, b) => a - b);
    const uniqueY = [...new Set(yVals.map((v) => parseFloat(v.toFixed(4))))].sort((a, b) => a - b);

    const nx = uniqueX.length;
    const ny = uniqueY.length;

    if (nx < 2 || ny < 2) return new THREE.BufferGeometry();

    const grid = new Map<string, number>();
    for (let i = 0; i < xVals.length; i++) {
      const key = `${parseFloat(xVals[i].toFixed(4))},${parseFloat(yVals[i].toFixed(4))}`;
      grid.set(key, zVals[i]);
    }

    const zMin = Math.min(...zVals);
    const zMax = Math.max(...zVals);
    const zRange = zMax - zMin || 1;

    const xMin = uniqueX[0]; const xMax = uniqueX[nx - 1];
    const yMin = uniqueY[0]; const yMax = uniqueY[ny - 1];
    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;

    const vertices: number[] = [];
    const colorArr: number[] = [];
    const indices: number[] = [];

    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const key = `${uniqueX[i]},${uniqueY[j]}`;
        const z = grid.get(key) ?? 0;
        vertices.push(
          ((uniqueX[i] - xMin) / xRange) * 2 - 1,
          ((z - zMin) / zRange) * 2 - 1,
          ((uniqueY[j] - yMin) / yRange) * 2 - 1
        );
        const t = (z - zMin) / zRange;
        const c = new THREE.Color(getColorFromMap(t, scene3D.colorMap));
        colorArr.push(c.r, c.g, c.b);
      }
    }

    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i;
        const b = a + 1;
        const c = a + nx;
        const d = c + 1;
        indices.push(a, b, d);
        indices.push(a, d, c);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colorArr, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [datasets, chartConfig.layers, scene3D.colorMap]);

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshPhongMaterial
        vertexColors
        side={THREE.DoubleSide}
        transparent
        opacity={scene3D.opacity}
        shininess={60}
      />
    </mesh>
  );
}

function Scatter3DPoints() {
  const datasets = usePlotStore((s) => s.datasets);
  const chartConfig = usePlotStore((s) => s.chartConfig);
  const scene3D = usePlotStore((s) => s.scene3D);

  const { positions, colors } = useMemo(() => {
    const layer = chartConfig.layers[0];
    if (!layer) return { positions: new Float32Array(0), colors: new Float32Array(0) };

    const ds = datasets.find((d) => d.id === layer.datasetId);
    if (!ds) return { positions: new Float32Array(0), colors: new Float32Array(0) };

    const xCol = ds.columns.find((c) => c.id === layer.xColumn);
    const yCol = ds.columns.find((c) => c.id === layer.yColumn);
    const zCol = ds.columns.find((c) => c.id === layer.zColumn);

    if (!xCol || !yCol || !zCol) return { positions: new Float32Array(0), colors: new Float32Array(0) };

    const xVals = xCol.values.map(Number);
    const yVals = yCol.values.map(Number);
    const zVals = zCol.values.map(Number);

    const xMin = Math.min(...xVals); const xMax = Math.max(...xVals);
    const yMin = Math.min(...yVals); const yMax = Math.max(...yVals);
    const zMin = Math.min(...zVals); const zMax = Math.max(...zVals);
    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;
    const zRange = zMax - zMin || 1;

    const pos = new Float32Array(xVals.length * 3);
    const col = new Float32Array(xVals.length * 3);

    for (let i = 0; i < xVals.length; i++) {
      pos[i * 3] = ((xVals[i] - xMin) / xRange) * 2 - 1;
      pos[i * 3 + 1] = ((zVals[i] - zMin) / zRange) * 2 - 1;
      pos[i * 3 + 2] = ((yVals[i] - yMin) / yRange) * 2 - 1;

      const t = (zVals[i] - zMin) / zRange;
      const c = new THREE.Color(getColorFromMap(t, scene3D.colorMap));
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }

    return { positions: pos, colors: col };
  }, [datasets, chartConfig.layers, scene3D.colorMap]);

  if (positions.length === 0) return null;

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={colors.length / 3}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.04} vertexColors transparent opacity={scene3D.opacity} sizeAttenuation />
    </points>
  );
}

function ChartTitle() {
  const title = usePlotStore((s) => s.chartConfig.title);
  if (!title) return null;
  return (
    <Text position={[0, 1.45, 0]} fontSize={0.12} color="#e4e4e7" anchorX="center" anchorY="bottom">
      {title}
    </Text>
  );
}

function Scene() {
  const scene3D = usePlotStore((s) => s.scene3D);
  const dataRange = useDataRange();

  return (
    <>
      <ambientLight intensity={scene3D.ambientIntensity} />
      <directionalLight
        position={[scene3D.lightAngle[0] / 45, scene3D.lightAngle[1] / 45, 1]}
        intensity={0.8}
      />
      <ChartTitle />
      {scene3D.showAxes && dataRange && <Axes3D range={dataRange} />}
      <OrbitControls enableDamping dampingFactor={0.1} />
    </>
  );
}

function ColorbarOverlay() {
  const scene3D = usePlotStore((s) => s.scene3D);
  const chartConfig = usePlotStore((s) => s.chartConfig);
  const dataRange = useDataRange();

  if (!scene3D.showColorbar || !dataRange) return null;

  const zTicks = niceScale(dataRange.zMin, dataRange.zMax);

  return (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
      <div className="flex flex-col items-end text-[10px]" style={{ color: 'var(--text-muted)' }}>
        {zTicks.map((v) => (
          <span key={v} className="leading-none">{v.toFixed(v === Math.round(v) ? 0 : 1)}</span>
        ))}
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <div
          className="w-4 rounded-sm"
          style={{
            height: '180px',
            background: getColorMapGradient(scene3D.colorMap),
          }}
        />
      </div>
      <div className="text-[10px] -rotate-90 whitespace-nowrap" style={{ color: 'var(--text-faint)' }}>
        {dataRange.zLabel}
      </div>
    </div>
  );
}

function LegendOverlay() {
  const chartConfig = usePlotStore((s) => s.chartConfig);
  const datasets = usePlotStore((s) => s.datasets);

  if (!chartConfig.legend.visible) return null;

  return (
    <div className={`absolute top-3 left-1/2 -translate-x-1/2 flex gap-4 rounded px-3 py-1.5`} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      {chartConfig.layers.filter((l) => l.visible).map((layer) => {
        const ds = datasets.find((d) => d.id === layer.datasetId);
        return (
          <div key={layer.id} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <div className="w-3 h-1 rounded" style={{ backgroundColor: layer.color }} />
            {ds?.name ?? '数据集'}
          </div>
        );
      })}
    </div>
  );
}

export default function Scene3D() {
  const chartConfig = usePlotStore((s) => s.chartConfig);
  const scene3D = usePlotStore((s) => s.scene3D);
  const theme = usePlotStore((s) => s.theme);

  const is3D = ['surface3d', 'scatter3d', 'contour3d', 'bar3d'].includes(chartConfig.type);

  if (!is3D) {
    return (
      <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-muted)' }}>
        请选择 3D 图表类型以启用 3D 可视化
      </div>
    );
  }

  const sceneBgFrom = theme === 'dark' ? '#0f0f1a' : '#e2e8f0';
  const sceneBgTo = theme === 'dark' ? '#1a1a2e' : '#f1f5f9';

  return (
    <div className="relative w-full h-full">
      <Canvas
        camera={{ position: scene3D.cameraPosition, fov: 50 }}
        gl={{ antialias: scene3D.antialias, preserveDrawingBuffer: true }}
        style={{ background: `linear-gradient(180deg, ${sceneBgFrom} 0%, ${sceneBgTo} 100%)` }}
      >
        <Scene />
        {(chartConfig.type === 'surface3d' || chartConfig.type === 'contour3d') && <SurfaceMesh />}
        {chartConfig.type === 'scatter3d' && <Scatter3DPoints />}
      </Canvas>
      <ColorbarOverlay />
      <LegendOverlay />
    </div>
  );
}
