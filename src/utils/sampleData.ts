import type { Dataset } from '@/types';
import i18n from '@/i18n';

let idCounter = 0;
function uid(): string {
  return `id_${Date.now()}_${++idCounter}`;
}

export function createEmptyDataset(name = i18n.t('sampleData.dataset1')): Dataset {
  return {
    id: uid(),
    name,
    columns: [
      { id: uid(), name: 'A', type: 'X', values: [] },
      { id: uid(), name: 'B', type: 'Y', values: [] },
    ],
  };
}

export function createSampleSineDataset(): Dataset {
  const xVals: number[] = [];
  const yVals: number[] = [];
  for (let i = 0; i <= 50; i++) {
    const x = (i / 50) * 2 * Math.PI;
    xVals.push(parseFloat(x.toFixed(4)));
    yVals.push(parseFloat(Math.sin(x).toFixed(4)));
  }
  return {
    id: uid(),
    name: i18n.t('sampleData.sine'),
    columns: [
      { id: uid(), name: 'X', type: 'X', values: xVals },
      { id: uid(), name: 'Y', type: 'Y', values: yVals },
    ],
  };
}

export function createSampleSurfaceDataset(): Dataset {
  const xVals: number[] = [];
  const yVals: number[] = [];
  const zVals: number[] = [];
  const n = 30;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x = (i / (n - 1)) * 4 - 2;
      const y = (j / (n - 1)) * 4 - 2;
      const r = Math.sqrt(x * x + y * y);
      const z = parseFloat((Math.sin(r) / r).toFixed(4));
      xVals.push(parseFloat(x.toFixed(4)));
      yVals.push(parseFloat(y.toFixed(4)));
      zVals.push(isNaN(z) ? 1 : z);
    }
  }
  return {
    id: uid(),
    name: i18n.t('sampleData.sincSurface'),
    columns: [
      { id: uid(), name: 'X', type: 'X', values: xVals },
      { id: uid(), name: 'Y', type: 'Y', values: yVals },
      { id: uid(), name: 'Z', type: 'Z', values: zVals },
    ],
  };
}

export function createSampleScatter3DDataset(): Dataset {
  const xVals: number[] = [];
  const yVals: number[] = [];
  const zVals: number[] = [];
  for (let i = 0; i < 200; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const r = 1 + Math.random() * 0.3;
    xVals.push(parseFloat((r * Math.sin(phi) * Math.cos(theta)).toFixed(4)));
    yVals.push(parseFloat((r * Math.sin(phi) * Math.sin(theta)).toFixed(4)));
    zVals.push(parseFloat((r * Math.cos(phi)).toFixed(4)));
  }
  return {
    id: uid(),
    name: i18n.t('sampleData.sphere'),
    columns: [
      { id: uid(), name: 'X', type: 'X', values: xVals },
      { id: uid(), name: 'Y', type: 'Y', values: yVals },
      { id: uid(), name: 'Z', type: 'Z', values: zVals },
    ],
  };
}

export function createSampleBarDataset(): Dataset {
  return {
    id: uid(),
    name: i18n.t('sampleData.barSample'),
    columns: [
      { id: uid(), name: 'Category', type: 'label', values: ['A', 'B', 'C', 'D', 'E'] },
      { id: uid(), name: 'Value', type: 'Y', values: [12, 19, 8, 15, 22] },
    ],
  };
}

export { uid };
