import { useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, FileCode } from 'lucide-react';
import { useChartStore, selectActiveChart } from '@/store/plotStore';
import { useUiStore } from '@/store/uiStore';
import { useToastStore } from '@/store/toastStore';
import SubplotView from '@/components/SubplotView';
import { exportFigureToPng, exportFigureToSvg } from '@/utils/exportLayout';
import { showContextMenu, type MenuItemOrSeparator } from '@/utils/contextMenu';

export default function ChartView() {
  const { t } = useTranslation();
  const rows = useChartStore((s) => s.figure.rows);
  const cols = useChartStore((s) => s.figure.cols);
  const gap = useChartStore((s) => s.figure.gap);
  const figure = useChartStore((s) => s.figure);
  const count = useChartStore((s) => s.figure.subplots.length);
  const theme = useUiStore((s) => s.theme);
  const addToast = useToastStore((s) => s.addToast);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleFigureContextMenu = useCallback(
    (e: React.MouseEvent) => {
      // Only offer figure-level export when there's more than one cell.
      if (count <= 1) return;
      const container = containerRef.current;
      if (!container) return;
      const active = selectActiveChart(useChartStore.getState());
      const { resolutionMultiplier, background, figureMultiplier } = active.exportConfig;
      const exportBg = background === 'white'
        ? '#ffffff'
        : background === 'theme'
          ? (theme === 'dark' ? '#18181b' : '#ffffff')
          : undefined;

      const items: MenuItemOrSeparator[] = [
        {
          label: t('context.exportFigurePng'),
          icon: <Image size={14} />,
          onClick: async () => {
            try {
              const cellDivs = Array.from(
                container.querySelectorAll<HTMLElement>('[data-chart-area]'),
              );
              if (cellDivs.length !== figure.subplots.length) return;
              const dataUrl = await exportFigureToPng(
                cellDivs, figure.subplots, rows, cols, gap,
                { scale: resolutionMultiplier, backgroundColor: exportBg, figureMultiplier },
              );
              const link = document.createElement('a');
              link.download = (active.title || 'figure') + '.png';
              link.href = dataUrl;
              link.click();
              addToast(t('toast.exportSuccess'), 'success');
            } catch {
              addToast(t('toast.exportFailed'), 'error');
            }
          },
        },
        {
          label: t('context.exportFigureSvg'),
          icon: <FileCode size={14} />,
          onClick: async () => {
            try {
              const cellDivs = Array.from(
                container.querySelectorAll<HTMLElement>('[data-chart-area]'),
              );
              if (cellDivs.length !== figure.subplots.length) return;
              const svgString = await exportFigureToSvg(
                cellDivs, figure.subplots, rows, cols, gap,
                { scale: resolutionMultiplier, backgroundColor: exportBg, figureMultiplier },
              );
              const blob = new Blob([svgString], { type: 'image/svg+xml' });
              const link = document.createElement('a');
              link.download = (active.title || 'figure') + '.svg';
              link.href = URL.createObjectURL(blob);
              link.click();
              setTimeout(() => URL.revokeObjectURL(link.href), 1000);
              addToast(t('toast.exportSuccess'), 'success');
            } catch {
              addToast(t('toast.exportFailed'), 'error');
            }
          },
        },
      ];
      showContextMenu(e, items);
    },
    [count, figure, rows, cols, gap, theme, t, addToast],
  );

  if (count === 1) {
    // Fast path: identical to today, no grid wrapper overhead.
    return <SubplotView subplotIndex={0} />;
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{
        display: 'grid',
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: `${gap}px`,
      }}
      onContextMenu={handleFigureContextMenu}
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="relative min-w-0 min-h-0">
          <SubplotView subplotIndex={i} />
        </div>
      ))}
    </div>
  );
}