import { OrbitControls } from '@react-three/drei';
import { useScene3DStore } from '@/store/scene3DStore';
import { useDataRange } from './types';
import { Axes3D } from './Axes3D';
import { ChartTitle } from './Overlays';

export function Scene() {
  const scene3D = useScene3DStore((s) => s.scene3D);
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
