import { useRef, useMemo } from 'react';
import { useChartStore } from '@/store/chartStore';
import { useDatasetStore } from '@/store/datasetStore';
import { useScene3DStore } from '@/store/scene3DStore';
import { getColorFromMap } from '@/utils/colormaps';
import * as THREE from 'three';
import type { LayerConfig } from '@/types';
import type { DataRange } from './types';
import { useDataRange } from './types';

/** Per-layer surface mesh */
function SurfaceMeshLayer({ layer, dataRange }: { layer: LayerConfig; dataRange: DataRange }) {
  const datasets = useDatasetStore((s) => s.datasets);
  const scene3D = useScene3DStore((s) => s.scene3D);

  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
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

    const xRange = dataRange.xMax - dataRange.xMin || 1;
    const yRange = dataRange.yMax - dataRange.yMin || 1;
    const zRange = dataRange.zMax - dataRange.zMin || 1;

    const vertices: number[] = [];
    const colorArr: number[] = [];
    const indices: number[] = [];

    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const key = `${uniqueX[i]},${uniqueY[j]}`;
        const z = grid.get(key) ?? 0;
        vertices.push(
          ((uniqueX[i] - dataRange.xMin) / xRange) * 2 - 1,
          ((z - dataRange.zMin) / zRange) * 2 - 1,
          ((uniqueY[j] - dataRange.yMin) / yRange) * 2 - 1
        );
        const t = (z - dataRange.zMin) / zRange;
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
  }, [datasets, layer, scene3D.colorMap, dataRange.xMin, dataRange.xMax, dataRange.yMin, dataRange.yMax, dataRange.zMin, dataRange.zMax]);

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

/** Multi-layer surface meshes */
export function SurfaceMesh() {
  const chartConfig = useChartStore((s) => s.chartConfig);
  const dataRange = useDataRange();

  if (!dataRange) return null;

  return (
    <>
      {chartConfig.layers.filter((l) => l.visible).map((layer) => (
        <SurfaceMeshLayer key={layer.id} layer={layer} dataRange={dataRange} />
      ))}
    </>
  );
}
