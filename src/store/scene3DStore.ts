import { create } from 'zustand';
import type { Scene3DConfig } from '@/types';

interface Scene3DStore {
  scene3D: Scene3DConfig;
  setScene3D: (config: Partial<Scene3DConfig>) => void;
}

export const useScene3DStore = create<Scene3DStore>()((set) => ({
  scene3D: {
    cameraPosition: [3, 3, 3],
    lightAngle: [45, 45],
    ambientIntensity: 0.4,
    opacity: 1,
    colorMap: 'viridis',
    showAxes: true,
    showColorbar: true,
    antialias: true,
    bloom: false,
  },

  setScene3D: (config) =>
    set((s) => ({ scene3D: { ...s.scene3D, ...config } })),
}));
