import { create } from 'zustand';

export interface HoverPoint {
  x: number | string;
  y: number | string;
  z?: number | string;
  curveNumber?: number;
  pointNumber?: number;
}

export interface ChartInteractionState {
  hover: HoverPoint | null;
  zoom: { x0?: number; x1?: number; y0?: number; y1?: number } | null;
  setHover: (p: HoverPoint | null) => void;
  setZoom: (z: ChartInteractionState['zoom']) => void;
  clear: () => void;
}

export const useChartInteractionStore = create<ChartInteractionState>()((set) => ({
  hover: null,
  zoom: null,
  setHover: (hover) => set({ hover }),
  setZoom: (zoom) => set({ zoom }),
  clear: () => set({ hover: null, zoom: null }),
}));
