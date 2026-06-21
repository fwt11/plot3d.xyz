import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { useDatasetStore } from '@/store/datasetStore';
import { useChartStore } from '@/store/chartStore';
import { useScene3DStore } from '@/store/scene3DStore';
import { getColorFromMap } from '@/utils/colormaps';
import * as THREE from 'three';
import type { LayerConfig } from '@/types';
import type { DataRange } from './types';
import { useDataRange, niceScale } from './types';

/** Build the grid data for a layer */
function buildGrid(layer: LayerConfig, datasets: ReturnType<typeof useDatasetStore.getState>['datasets']) {
  const ds = datasets.find((d) => d.id === layer.datasetId);
  if (!ds) return null;

  const xCol = ds.columns.find((c) => c.id === layer.xColumn);
  const yCol = ds.columns.find((c) => c.id === layer.yColumn);
  const zCol = ds.columns.find((c) => c.id === layer.zColumn);

  if (!xCol || !yCol || !zCol) return null;

  const xVals = xCol.values.map(Number);
  const yVals = yCol.values.map(Number);
  const zVals = zCol.values.map(Number);

  const uniqueX = [...new Set(xVals.map((v) => parseFloat(v.toFixed(4))))].sort((a, b) => a - b);
  const uniqueY = [...new Set(yVals.map((v) => parseFloat(v.toFixed(4))))].sort((a, b) => a - b);

  const nx = uniqueX.length;
  const ny = uniqueY.length;

  if (nx < 2 || ny < 2) return null;

  const grid = new Map<string, number>();
  for (let i = 0; i < xVals.length; i++) {
    const key = `${parseFloat(xVals[i].toFixed(4))},${parseFloat(yVals[i].toFixed(4))}`;
    grid.set(key, zVals[i]);
  }

  return { uniqueX, uniqueY, nx, ny, grid };
}

/**
 * Marching squares with proper ambiguity resolution.
 * Returns pairs of edge crossing points for a single cell at a given contour level.
 * Uses the bilinear interpolation center value to resolve the ambiguous saddle case.
 */
function marchingSquaresCell(
  z00: number, z10: number, z01: number, z11: number,
  x0: number, x1: number, y0: number, y1: number,
  level: number,
): [number, number][][] {
  // Classify each corner: above (1) or below/equal (0) the level
  const c00 = z00 >= level ? 1 : 0;
  const c10 = z10 >= level ? 1 : 0;
  const c01 = z01 >= level ? 1 : 0;
  const c11 = z11 >= level ? 1 : 0;

  const caseIndex = c00 | (c10 << 1) | (c01 << 2) | (c11 << 3);

  if (caseIndex === 0 || caseIndex === 15) return []; // all same side

  // Interpolate crossing points on each edge
  const crossings: [number, number][] = [];

  // Bottom edge (y=y0, x from x0 to x1): between c00 and c10
  if (c00 !== c10) {
    const t = (level - z00) / (z10 - z00);
    crossings.push([x0 + t * (x1 - x0), y0]);
  }
  // Top edge (y=y1, x from x0 to x1): between c01 and c11
  if (c01 !== c11) {
    const t = (level - z01) / (z11 - z01);
    crossings.push([x0 + t * (x1 - x0), y1]);
  }
  // Left edge (x=x0, y from y0 to y1): between c00 and c01
  if (c00 !== c01) {
    const t = (level - z00) / (z01 - z00);
    crossings.push([x0, y0 + t * (y1 - y0)]);
  }
  // Right edge (x=x1, y from y0 to y1): between c10 and c11
  if (c10 !== c11) {
    const t = (level - z10) / (z11 - z10);
    crossings.push([x1, y0 + t * (y1 - y0)]);
  }

  // For cases with 3 crossings (ambiguous saddle cases: 5, 10),
  // or 4 crossings (case 6, 9), resolve using bilinear center value
  if (crossings.length === 3) {
    // This shouldn't happen with proper classification, but handle gracefully
    // by pairing first two and dropping the third
    return [[crossings[0], crossings[1]]];
  }

  if (crossings.length === 4) {
    // Ambiguous case: use bilinear center to decide pairing
    const centerValue = 0.25 * (z00 + z10 + z01 + z11);
    if (centerValue >= level) {
      // Connect corners that are "above" together
      // Pair: bottom-left↔bottom-right + top-left↔top-right
      // or: bottom-left↔top-left + bottom-right↔top-right
      // Use the saddle point to decide
      return [
        [crossings[0], crossings[2]],
        [crossings[1], crossings[3]],
      ];
    } else {
      return [
        [crossings[0], crossings[1]],
        [crossings[2], crossings[3]],
      ];
    }
  }

  // 2 crossings: simple line segment
  if (crossings.length === 2) {
    return [[crossings[0], crossings[1]]];
  }

  return [];
}

/** Contour lines for a single layer on the surface */
function ContourLinesLayer({ layer, dataRange }: { layer: LayerConfig; dataRange: DataRange }) {
  const datasets = useDatasetStore((s) => s.datasets);

  const contourPaths = useMemo(() => {
    const gridData = buildGrid(layer, datasets);
    if (!gridData) return [];

    const { uniqueX, uniqueY, nx, ny, grid } = gridData;

    const xRange = dataRange.xMax - dataRange.xMin || 1;
    const yRange = dataRange.yMax - dataRange.yMin || 1;
    const zRange = dataRange.zMax - dataRange.zMin || 1;

    // Generate contour levels
    const zTicks = niceScale(dataRange.zMin, dataRange.zMax, 8);
    const paths: { level: number; points: THREE.Vector3[] }[] = [];

    for (const level of zTicks) {
      const levelNorm = ((level - dataRange.zMin) / zRange) * 2 - 1;
      if (levelNorm < -1 || levelNorm > 1) continue;

      for (let j = 0; j < ny - 1; j++) {
        for (let i = 0; i < nx - 1; i++) {
          const z00 = grid.get(`${uniqueX[i]},${uniqueY[j]}`);
          const z10 = grid.get(`${uniqueX[i + 1]},${uniqueY[j]}`);
          const z01 = grid.get(`${uniqueX[i]},${uniqueY[j + 1]}`);
          const z11 = grid.get(`${uniqueX[i + 1]},${uniqueY[j + 1]}`);

          if (z00 === undefined || z10 === undefined || z01 === undefined || z11 === undefined) continue;

          const x0 = ((uniqueX[i] - dataRange.xMin) / xRange) * 2 - 1;
          const x1 = ((uniqueX[i + 1] - dataRange.xMin) / xRange) * 2 - 1;
          const y0 = ((uniqueY[j] - dataRange.yMin) / yRange) * 2 - 1;
          const y1 = ((uniqueY[j + 1] - dataRange.yMin) / yRange) * 2 - 1;

          const segments = marchingSquaresCell(z00, z10, z01, z11, x0, x1, y0, y1, level);

          for (const seg of segments) {
            // Map from data (x, y) to Three.js (x, z, y) where Three.js Y = data Z (vertical)
            paths.push({
              level,
              points: [
                new THREE.Vector3(seg[0][0], levelNorm, seg[0][1]),
                new THREE.Vector3(seg[1][0], levelNorm, seg[1][1]),
              ],
            });
          }
        }
      }
    }

    return paths;
  }, [datasets, layer, dataRange.xMin, dataRange.xMax, dataRange.yMin, dataRange.yMax, dataRange.zMin, dataRange.zMax]);

  if (contourPaths.length === 0) return null;

  return (
    <>
      {contourPaths.map((path, idx) => (
        <Line
          key={`contour-${layer.id}-${idx}`}
          points={path.points}
          color={layer.color}
          lineWidth={1.5}
          transparent
          opacity={0.8}
        />
      ))}
    </>
  );
}

/** Filled contour regions between levels for a single layer */
function ContourFillLayerInner({ layer, dataRange }: { layer: LayerConfig; dataRange: DataRange }) {
  const datasets = useDatasetStore((s) => s.datasets);
  const scene3D = useScene3DStore((s) => s.scene3D);

  const fillMeshes = useMemo(() => {
    const gridData = buildGrid(layer, datasets);
    if (!gridData) return [];

    const { uniqueX, uniqueY, nx, ny, grid } = gridData;

    const xRange = dataRange.xMax - dataRange.xMin || 1;
    const yRange = dataRange.yMax - dataRange.yMin || 1;
    const zRange = dataRange.zMax - dataRange.zMin || 1;

    const zTicks = niceScale(dataRange.zMin, dataRange.zMax, 8);

    // Build fill regions between consecutive levels
    const levels = [dataRange.zMin, ...zTicks, dataRange.zMax];
    const meshes: { vertices: number[]; indices: number[]; color: string; levelIdx: number }[] = [];

    for (let li = 0; li < levels.length - 1; li++) {
      const lowerLevel = levels[li];
      const upperLevel = levels[li + 1];
      const midLevel = (lowerLevel + upperLevel) / 2;
      const midNorm = ((midLevel - dataRange.zMin) / zRange) * 2 - 1;

      // Get color for this band's midpoint
      const t = (midLevel - dataRange.zMin) / zRange;
      const color = getColorFromMap(t, scene3D.colorMap);

      const vertices: number[] = [];
      const indices: number[] = [];

      for (let j = 0; j < ny - 1; j++) {
        for (let i = 0; i < nx - 1; i++) {
          const z00 = grid.get(`${uniqueX[i]},${uniqueY[j]}`);
          const z10 = grid.get(`${uniqueX[i + 1]},${uniqueY[j]}`);
          const z01 = grid.get(`${uniqueX[i]},${uniqueY[j + 1]}`);
          const z11 = grid.get(`${uniqueX[i + 1]},${uniqueY[j + 1]}`);

          if (z00 === undefined || z10 === undefined || z01 === undefined || z11 === undefined) continue;

          // Check if any corner of this cell falls within the current band
          const inBand = (z: number) => z >= lowerLevel && z < upperLevel;
          const anyInBand = inBand(z00) || inBand(z10) || inBand(z01) || inBand(z11);
          if (!anyInBand) continue;

          const x0 = ((uniqueX[i] - dataRange.xMin) / xRange) * 2 - 1;
          const x1 = ((uniqueX[i + 1] - dataRange.xMin) / xRange) * 2 - 1;
          const y0 = ((uniqueY[j] - dataRange.yMin) / yRange) * 2 - 1;
          const y1 = ((uniqueY[j + 1] - dataRange.yMin) / yRange) * 2 - 1;

          // For the fill, render the cell as two triangles at the mid-level height
          // This is a simplified approach: project the cell onto the contour plane
          const baseIdx = vertices.length / 3;

          // Map from data (x, y) to Three.js (x, z, y) where Three.js Y = data Z (vertical)
          vertices.push(x0, midNorm, y0);
          vertices.push(x1, midNorm, y0);
          vertices.push(x0, midNorm, y1);
          vertices.push(x1, midNorm, y1);

          indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
          indices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2);
        }
      }

      if (vertices.length > 0) {
        meshes.push({ vertices, indices, color, levelIdx: li });
      }
    }

    return meshes;
  }, [datasets, layer, dataRange.xMin, dataRange.xMax, dataRange.yMin, dataRange.yMax, dataRange.zMin, dataRange.zMax, scene3D.colorMap]);

  if (fillMeshes.length === 0) return null;

  return (
    <>
      {fillMeshes.map((mesh) => {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(mesh.vertices, 3));
        geo.setIndex(mesh.indices);
        geo.computeVertexNormals();

        return (
          <mesh key={`fill-${layer.id}-${mesh.levelIdx}`} geometry={geo}>
            <meshBasicMaterial
              color={mesh.color}
              transparent
              opacity={0.15}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </>
  );
}

/** Multi-layer contour lines (renders on top of surface) */
export function ContourLines() {
  const chartConfig = useChartStore((s) => s.chartConfig);
  const dataRange = useDataRange();

  if (!dataRange) return null;

  return (
    <>
      {chartConfig.layers.filter((l) => l.visible).map((layer) => (
        <ContourLinesLayer key={layer.id} layer={layer} dataRange={dataRange} />
      ))}
    </>
  );
}

/** Multi-layer filled contour regions */
export function ContourFillLayer() {
  const chartConfig = useChartStore((s) => s.chartConfig);
  const dataRange = useDataRange();

  if (!dataRange) return null;

  return (
    <>
      {chartConfig.layers.filter((l) => l.visible).map((layer) => (
        <ContourFillLayerInner key={layer.id} layer={layer} dataRange={dataRange} />
      ))}
    </>
  );
}
