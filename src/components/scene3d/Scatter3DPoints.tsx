import { useMemo } from 'react';
import { useDatasetStore } from '@/store/datasetStore';
import { useScene3DStore } from '@/store/scene3DStore';
import { useChartStore } from '@/store/chartStore';
import { getColorFromMap } from '@/utils/colormaps';
import * as THREE from 'three';
import type { LayerConfig } from '@/types';
import type { DataRange } from './types';
import { useDataRange } from './types';

/** Per-layer scatter points */
function Scatter3DLayerPoints({ layer, dataRange }: { layer: LayerConfig; dataRange: DataRange }) {
  const datasets = useDatasetStore((s) => s.datasets);
  const scene3D = useScene3DStore((s) => s.scene3D);

  const { positions, colors } = useMemo(() => {
    const ds = datasets.find((d) => d.id === layer.datasetId);
    if (!ds) return { positions: new Float32Array(0), colors: new Float32Array(0) };

    const xCol = ds.columns.find((c) => c.id === layer.xColumn);
    const yCol = ds.columns.find((c) => c.id === layer.yColumn);
    const zCol = ds.columns.find((c) => c.id === layer.zColumn);

    if (!xCol || !yCol || !zCol) return { positions: new Float32Array(0), colors: new Float32Array(0) };

    const xVals = xCol.values.map(Number);
    const yVals = yCol.values.map(Number);
    const zVals = zCol.values.map(Number);

    const xRange = dataRange.xMax - dataRange.xMin || 1;
    const yRange = dataRange.yMax - dataRange.yMin || 1;
    const zRange = dataRange.zMax - dataRange.zMin || 1;

    const pos = new Float32Array(xVals.length * 3);
    const col = new Float32Array(xVals.length * 3);

    for (let i = 0; i < xVals.length; i++) {
      pos[i * 3] = ((xVals[i] - dataRange.xMin) / xRange) * 2 - 1;
      pos[i * 3 + 1] = ((zVals[i] - dataRange.zMin) / zRange) * 2 - 1;
      pos[i * 3 + 2] = ((yVals[i] - dataRange.yMin) / yRange) * 2 - 1;

      const t = (zVals[i] - dataRange.zMin) / zRange;
      const c = new THREE.Color(getColorFromMap(t, scene3D.colorMap));
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }

    return { positions: pos, colors: col };
  }, [datasets, layer, scene3D.colorMap, dataRange.xMin, dataRange.xMax, dataRange.yMin, dataRange.yMax, dataRange.zMin, dataRange.zMax]);

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

/** Multi-layer scatter points */
export function Scatter3DPoints() {
  const chartConfig = useChartStore((s) => s.chartConfig);
  const dataRange = useDataRange();

  if (!dataRange) return null;

  return (
    <>
      {chartConfig.layers.filter((l) => l.visible).map((layer) => (
        <Scatter3DLayerPoints key={layer.id} layer={layer} dataRange={dataRange} />
      ))}
    </>
  );
}
