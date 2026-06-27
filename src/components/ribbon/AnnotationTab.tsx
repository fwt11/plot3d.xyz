import { useTranslation } from 'react-i18next';
import { useAnnotationToolStore } from '@/store/plotStore';
import { getAnnotationTools, type AnnotationTool } from '@/utils/annotations';
import { RibbonGroup } from './RibbonGroup';

export function AnnotationTab() {
  const { t } = useTranslation();
  const activeTool = useAnnotationToolStore((s) => s.activeTool);
  const setActiveTool = useAnnotationToolStore((s) => s.setActiveTool);

  const tools = getAnnotationTools(t);

  const toggleTool = (type: AnnotationTool) => {
    setActiveTool(activeTool === type ? 'select' : type);
  };

  return (
    <div className="flex items-stretch">
      <RibbonGroup label={t('annotation.addAnnotation')}>
        {tools.map(({ type, label, icon }) => (
          <button
            key={type}
            onClick={() => toggleTool(type)}
            className={`ribbon-btn ${activeTool === type ? 'ring-1 ring-sky-500 bg-sky-500/10' : ''}`}
            aria-label={label}
            title={label}
          >
            {icon}
            <span className="text-xs">{label}</span>
          </button>
        ))}
      </RibbonGroup>
    </div>
  );
}
