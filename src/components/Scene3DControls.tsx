import { usePlotStore } from '@/store/plotStore';
import { getColorMapGradient } from '@/utils/colormaps';
import type { ColorMapName } from '@/types';
import { RotateCcw, Eye, EyeOff, Sun, Droplets, Palette, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const colorMapNames: ColorMapName[] = ['jet', 'viridis', 'hot', 'coolwarm', 'parula', 'plasma'];

export default function Scene3DControls() {
  const { t } = useTranslation();
  const scene3D = usePlotStore((s) => s.scene3D);
  const setScene3D = usePlotStore((s) => s.setScene3D);

  return (
    <div className="absolute top-4 right-4 w-56 backdrop-blur-md rounded-lg p-3 space-y-3 text-xs" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="font-medium text-sm mb-2" style={{ color: 'var(--text-primary)' }}>{t('scene3d.controls')}</div>

      {/* Color Map */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
          <Palette size={12} />
          <span>{t('scene3d.colorMap')}</span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {colorMapNames.map((name) => (
            <button
              key={name}
              onClick={() => setScene3D({ colorMap: name })}
              className={`h-5 rounded text-[10px] font-mono transition-all ${
                scene3D.colorMap === name
                  ? 'ring-1 scale-105'
                  : 'opacity-70 hover:opacity-100'
              }`}
              style={{
                background: getColorMapGradient(name),
                ...(scene3D.colorMap === name ? { boxShadow: '0 0 0 1px var(--accent)' } : {}),
              }}
            >
              <span className="text-white drop-shadow-md">{name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Ambient Light */}
      <div className="space-y-1">
        <div className="flex items-center justify-between" style={{ color: 'var(--text-secondary)' }}>
          <div className="flex items-center gap-1.5">
            <Sun size={12} />
            <span>{t('scene3d.ambientLight')}</span>
          </div>
          <span style={{ color: 'var(--text-muted)' }}>{scene3D.ambientIntensity.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={scene3D.ambientIntensity}
          onChange={(e) => setScene3D({ ambientIntensity: Number(e.target.value) })}
          className="w-full accent-sky-500"
        />
      </div>

      {/* Light Angle */}
      <div className="space-y-1">
        <div style={{ color: 'var(--text-secondary)' }}>{t('scene3d.lightAngle')}</div>
        <div className="flex gap-2">
          <label className="flex-1 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            {t('scene3d.horizontal')}
            <input
              type="range"
              min="0"
              max="360"
              value={scene3D.lightAngle[0]}
              onChange={(e) => setScene3D({ lightAngle: [Number(e.target.value), scene3D.lightAngle[1]] })}
              className="flex-1 accent-sky-500"
            />
          </label>
        </div>
        <div className="flex gap-2">
          <label className="flex-1 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            {t('scene3d.vertical')}
            <input
              type="range"
              min="0"
              max="90"
              value={scene3D.lightAngle[1]}
              onChange={(e) => setScene3D({ lightAngle: [scene3D.lightAngle[0], Number(e.target.value)] })}
              className="flex-1 accent-sky-500"
            />
          </label>
        </div>
      </div>

      {/* Opacity */}
      <div className="space-y-1">
        <div className="flex items-center justify-between" style={{ color: 'var(--text-secondary)' }}>
          <div className="flex items-center gap-1.5">
            <Droplets size={12} />
            <span>{t('scene3d.opacity')}</span>
          </div>
          <span style={{ color: 'var(--text-muted)' }}>{scene3D.opacity.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.05"
          value={scene3D.opacity}
          onChange={(e) => setScene3D({ opacity: Number(e.target.value) })}
          className="w-full accent-sky-500"
        />
      </div>

      {/* Toggles */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setScene3D({ showAxes: !scene3D.showAxes })}
          className={`flex items-center gap-1 px-2 py-1 rounded transition-colors`}
          style={scene3D.showAxes ? { background: 'rgba(14,165,233,0.2)', color: 'var(--accent)' } : { color: 'var(--text-muted)' }}
        >
          {scene3D.showAxes ? <Eye size={12} /> : <EyeOff size={12} />}
          {t('scene3d.axes')}
        </button>
        <button
          onClick={() => setScene3D({ bloom: !scene3D.bloom })}
          className={`flex items-center gap-1 px-2 py-1 rounded transition-colors`}
          style={scene3D.bloom ? { background: 'rgba(14,165,233,0.2)', color: 'var(--accent)' } : { color: 'var(--text-muted)' }}
        >
          <Sparkles size={12} />
          {t('scene3d.bloom')}
        </button>
      </div>

      {/* Reset */}
      <button
        onClick={() => setScene3D({ cameraPosition: [3, 3, 3] })}
        className="flex items-center gap-1.5 w-full justify-center px-3 py-1.5 rounded transition-colors"
        style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-primary)' }}
      >
        <RotateCcw size={12} />
        {t('scene3d.resetView')}
      </button>
    </div>
  );
}
