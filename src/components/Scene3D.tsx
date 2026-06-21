import { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { useChartStore } from '@/store/chartStore';
import { useScene3DStore } from '@/store/scene3DStore';
import { useUiStore } from '@/store/uiStore';
import { is3DChart } from '@/utils/chart';
import { useTranslation } from 'react-i18next';
import { Scene } from './scene3d/Scene';
import { SurfaceMesh } from './scene3d/SurfaceMesh';
import { Scatter3DPoints } from './scene3d/Scatter3DPoints';
import { ContourLines, ContourFillLayer } from './scene3d/ContourLines';
import { Bar3DPoints } from './scene3d/Bar3D';
import { ColorbarOverlay, LegendOverlay } from './scene3d/Overlays';

export default function Scene3D() {
  const { t } = useTranslation();
  const chartConfig = useChartStore((s) => s.chartConfig);
  const scene3D = useScene3DStore((s) => s.scene3D);
  const theme = useUiStore((s) => s.theme);
  const containerRef = useRef<HTMLDivElement>(null);

  const is3D = is3DChart(chartConfig.type);

  if (!is3D) {
    return (
      <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-muted)' }}>
        {t('scene3dView.select3d')}
      </div>
    );
  }

  const sceneBgFrom = theme === 'dark' ? '#0f0f1a' : '#e2e8f0';
  const sceneBgTo = theme === 'dark' ? '#1a1a2e' : '#f1f5f9';

  return (
    <div ref={containerRef} className="relative w-full h-full" data-chart-area-3d>
      <Canvas
        camera={{ position: scene3D.cameraPosition, fov: 50 }}
        gl={{ antialias: scene3D.antialias, preserveDrawingBuffer: true }}
        style={{ background: `linear-gradient(180deg, ${sceneBgFrom} 0%, ${sceneBgTo} 100%)` }}
      >
        <Scene />
        {(chartConfig.type === 'surface3d' || chartConfig.type === 'contour3d') && <SurfaceMesh />}
        {chartConfig.type === 'contour3d' && <ContourFillLayer />}
        {chartConfig.type === 'contour3d' && <ContourLines />}
        {chartConfig.type === 'scatter3d' && <Scatter3DPoints />}
        {chartConfig.type === 'bar3d' && <Bar3DPoints />}
      </Canvas>
      <ColorbarOverlay />
      <LegendOverlay />
    </div>
  );
}
