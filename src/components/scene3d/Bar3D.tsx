import { useRef, useMemo, useEffect } from 'react';
import { useChartStore } from '@/store/chartStore';
import { useDatasetStore } from '@/store/datasetStore';
import { useScene3DStore } from '@/store/scene3DStore';
import { getColorFromMap } from '@/utils/colormaps';
import * as THREE from 'three';
import type { LayerConfig } from '@/types';
import type { DataRange } from './types';
import { useDataRange } from './types';

/** Per-layer 3D bar chart using InstancedMesh for performance */
function Bar3DLayer({ layer, dataRange }: { layer: LayerConfig; dataRange: DataRange }) {
  const datasets = useDatasetStore((s) => s.datasets);
  const scene3D = useScene3DStore((s) => s.scene3D);
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const { count, matrixArray, colorArray } = useMemo(() => {
    const ds = datasets.find((d) => d.id === layer.datasetId);
    if (!ds) return { count: 0, matrixArray: new Float32Array(0), colorArray: new Float32Array(0) };

    const xCol = ds.columns.find((c) => c.id === layer.xColumn);
    const yCol = ds.columns.find((c) => c.id === layer.yColumn);
    const zCol = ds.columns.find((c) => c.id === layer.zColumn);

    if (!xCol || !yCol || !zCol) return { count: 0, matrixArray: new Float32Array(0), colorArray: new Float32Array(0) };

    const xVals = xCol.values.map(Number);
    const yVals = yCol.values.map(Number);
    const zVals = zCol.values.map(Number);

    const xRange = dataRange.xMax - dataRange.xMin || 1;
    const yRange = dataRange.yMax - dataRange.yMin || 1;
    const zRange = dataRange.zMax - dataRange.zMin || 1;

    // Calculate bar width based on data density
    const uniqueX = [...new Set(xVals.map((v) => parseFloat(v.toFixed(4))))].sort((a, b) => a - b);
    const uniqueY = [...new Set(yVals.map((v) => parseFloat(v.toFixed(4))))].sort((a, b) => a - b);

    const dx = uniqueX.length > 1 ? (uniqueX[1] - uniqueX[0]) / xRange * 2 : 0.1;
    const dy = uniqueY.length > 1 ? (uniqueY[1] - uniqueY[0]) / yRange * 2 : 0.1;
    const barWidthX = Math.min(dx * 0.7, 0.15);
    const barWidthZ = Math.min(dy * 0.7, 0.15);

    const bars = xVals.map((x, i) => {
      const z = zVals[i];
      const y = yVals[i];

      const normX = ((x - dataRange.xMin) / xRange) * 2 - 1;
      const normZ = ((y - dataRange.yMin) / yRange) * 2 - 1;
      const normH = ((z - dataRange.zMin) / zRange) * 2;

      const height = Math.max(normH, 0.001);
      const posY = -1 + height / 2;

      const t = (z - dataRange.zMin) / zRange;
      const color = getColorFromMap(t, scene3D.colorMap);

      return { position: [normX, posY, normZ] as [number, number, number], size: [barWidthX, height, barWidthZ] as [number, number, number], color };
    });

    const matrices = new Float32Array(bars.length * 16);
    const colors = new Float32Array(bars.length * 3);

    const tempMatrix = new THREE.Matrix4();
    const tempColor = new THREE.Color();

    bars.forEach((bar, i) => {
      tempMatrix.makeScale(bar.size[0], bar.size[1], bar.size[2]);
      tempMatrix.setPosition(bar.position[0], bar.position[1], bar.position[2]);
      tempMatrix.toArray(matrices, i * 16);
      tempColor.set(bar.color);
      colors[i * 3] = tempColor.r;
      colors[i * 3 + 1] = tempColor.g;
      colors[i * 3 + 2] = tempColor.b;
    });

    return { count: bars.length, matrixArray: matrices, colorArray: colors };
  }, [datasets, layer, dataRange.xMin, dataRange.xMax, dataRange.yMin, dataRange.yMax, dataRange.zMin, dataRange.zMax, scene3D.colorMap]);

  useEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const tempMatrix = new THREE.Matrix4();
    const tempColor = new THREE.Color();

    for (let i = 0; i < count; i++) {
      tempMatrix.fromArray(matrixArray, i * 16);
      mesh.setMatrixAt(i, tempMatrix);
      tempColor.fromArray(colorArray, i * 3);
      mesh.setColorAt(i, tempColor);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [count, matrixArray, colorArray]);

  if (count === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshPhongMaterial vertexColors transparent opacity={scene3D.opacity} shininess={40} />
    </instancedMesh>
  );
}

/** Multi-layer 3D bars */
export function Bar3DPoints() {
  const chartConfig = useChartStore((s) => s.chartConfig);
  const dataRange = useDataRange();

  if (!dataRange) return null;

  return (
    <>
      {chartConfig.layers.filter((l) => l.visible).map((layer) => (
        <Bar3DLayer key={layer.id} layer={layer} dataRange={dataRange} />
      ))}
    </>
  );
}
