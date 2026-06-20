import { usePlotStore } from '@/store/plotStore';
import { uid } from '@/utils/sampleData';
import type { AnnotationType, Annotation } from '@/types';
import { Plus, Trash2, Eye, EyeOff, Type, ArrowUpRight, Square, Sigma } from 'lucide-react';

const annotationTypes: { type: AnnotationType; label: string; icon: React.ReactNode }[] = [
  { type: 'text', label: '文本', icon: <Type size={12} /> },
  { type: 'latex', label: 'LaTeX', icon: <Sigma size={12} /> },
  { type: 'arrow', label: '箭头', icon: <ArrowUpRight size={12} /> },
  { type: 'rect', label: '矩形', icon: <Square size={12} /> },
];

function createDefaultAnnotation(type: AnnotationType): Annotation {
  const base = {
    id: uid(),
    type,
    x: 50,
    y: 50,
    content: type === 'latex' ? '$E = mc^2$' : type === 'text' ? '标注文本' : '',
    fontSize: 14,
    color: '#e4e4e7',
    visible: true,
  };
  if (type === 'arrow') {
    return { ...base, content: '', arrowTo: { x: 70, y: 30 } };
  }
  if (type === 'rect') {
    return { ...base, content: '', rectSize: { w: 20, h: 15 } };
  }
  return base;
}

export default function AnnotationPanel() {
  const annotations = usePlotStore((s) => s.chartConfig.annotations);
  const addAnnotation = usePlotStore((s) => s.addAnnotation);
  const removeAnnotation = usePlotStore((s) => s.removeAnnotation);
  const updateAnnotation = usePlotStore((s) => s.updateAnnotation);

  return (
    <div className="space-y-2">
      {/* Add buttons */}
      <div className="flex flex-wrap gap-1">
        {annotationTypes.map(({ type, label, icon }) => (
          <button
            key={type}
            onClick={() => addAnnotation(createDefaultAnnotation(type))}
            className="flex items-center gap-1 px-2 py-1 text-[10px] text-zinc-400 hover:text-sky-400 bg-zinc-800/50 hover:bg-zinc-700/50 rounded transition-colors"
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Annotation list */}
      {annotations.length === 0 && (
        <div className="text-[10px] text-zinc-600 py-2 text-center">
          点击上方按钮添加标注
        </div>
      )}

      {annotations.map((ann) => (
        <div key={ann.id} className="p-2 bg-zinc-800/50 rounded space-y-1.5">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => updateAnnotation(ann.id, { visible: !ann.visible })}
              className="text-zinc-400 hover:text-zinc-200"
            >
              {ann.visible ? <Eye size={11} /> : <EyeOff size={11} />}
            </button>
            <span className="text-[10px] text-zinc-500 uppercase">
              {ann.type === 'latex' ? 'LaTeX' : ann.type}
            </span>
            <input
              type="color"
              value={ann.color}
              onChange={(e) => updateAnnotation(ann.id, { color: e.target.value })}
              className="w-4 h-4 rounded cursor-pointer bg-transparent border-0 ml-auto"
            />
            <button
              onClick={() => removeAnnotation(ann.id)}
              className="text-zinc-600 hover:text-rose-400 transition-colors"
            >
              <Trash2 size={11} />
            </button>
          </div>

          {/* Content input */}
          {(ann.type === 'text' || ann.type === 'latex') && (
            <input
              type="text"
              value={ann.content}
              onChange={(e) => updateAnnotation(ann.id, { content: e.target.value })}
              placeholder={ann.type === 'latex' ? '输入 LaTeX，如 $E=mc^2$' : '输入文本'}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-xs text-zinc-300 outline-none focus:border-sky-500/50 font-mono"
            />
          )}

          {/* Position */}
          <div className="flex gap-2">
            <label className="flex items-center gap-1 text-[10px] text-zinc-500">
              X
              <input
                type="number"
                value={ann.x}
                onChange={(e) => updateAnnotation(ann.id, { x: Number(e.target.value) })}
                className="w-12 bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-zinc-300 outline-none focus:border-sky-500/50"
              />
            </label>
            <label className="flex items-center gap-1 text-[10px] text-zinc-500">
              Y
              <input
                type="number"
                value={ann.y}
                onChange={(e) => updateAnnotation(ann.id, { y: Number(e.target.value) })}
                className="w-12 bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-zinc-300 outline-none focus:border-sky-500/50"
              />
            </label>
            <label className="flex items-center gap-1 text-[10px] text-zinc-500">
              字号
              <input
                type="number"
                value={ann.fontSize}
                min={8}
                max={72}
                onChange={(e) => updateAnnotation(ann.id, { fontSize: Number(e.target.value) })}
                className="w-10 bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-zinc-300 outline-none focus:border-sky-500/50"
              />
            </label>
          </div>

          {/* Arrow target */}
          {ann.type === 'arrow' && ann.arrowTo && (
            <div className="flex gap-2">
              <label className="flex items-center gap-1 text-[10px] text-zinc-500">
                →X
                <input
                  type="number"
                  value={ann.arrowTo.x}
                  onChange={(e) => updateAnnotation(ann.id, { arrowTo: { ...ann.arrowTo, x: Number(e.target.value) } })}
                  className="w-12 bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-zinc-300 outline-none focus:border-sky-500/50"
                />
              </label>
              <label className="flex items-center gap-1 text-[10px] text-zinc-500">
                →Y
                <input
                  type="number"
                  value={ann.arrowTo.y}
                  onChange={(e) => updateAnnotation(ann.id, { arrowTo: { ...ann.arrowTo, y: Number(e.target.value) } })}
                  className="w-12 bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-zinc-300 outline-none focus:border-sky-500/50"
                />
              </label>
            </div>
          )}

          {/* Rect size */}
          {ann.type === 'rect' && ann.rectSize && (
            <div className="flex gap-2">
              <label className="flex items-center gap-1 text-[10px] text-zinc-500">
                宽
                <input
                  type="number"
                  value={ann.rectSize.w}
                  onChange={(e) => updateAnnotation(ann.id, { rectSize: { ...ann.rectSize, w: Number(e.target.value) } })}
                  className="w-12 bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-zinc-300 outline-none focus:border-sky-500/50"
                />
              </label>
              <label className="flex items-center gap-1 text-[10px] text-zinc-500">
                高
                <input
                  type="number"
                  value={ann.rectSize.h}
                  onChange={(e) => updateAnnotation(ann.id, { rectSize: { ...ann.rectSize, h: Number(e.target.value) } })}
                  className="w-12 bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-zinc-300 outline-none focus:border-sky-500/50"
                />
              </label>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
