import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useChartStore } from '@/store/chartStore';
import { useUiStore } from '@/store/uiStore';
import { useToastStore } from '@/store/toastStore';
import { is3DChart } from '@/utils/chart';
import { Download, X, Eye } from 'lucide-react';

import { encodeTiff } from '@/utils/tiffEncoder';
import { export3DToPng, serialize2DChartSVG, export2DChartPNGFromSVG } from '@/utils/exportLayout';

type PdfPageSize = 'a4' | 'a3' | 'letter' | 'legal' | 'auto';
type ExportFormat = 'png' | 'svg' | 'pdf' | 'tiff';

const PDF_PAGE_SIZES: Record<PdfPageSize, { w: number; h: number; label: string }> = {
  a4: { w: 297, h: 210, label: 'A4' },
  a3: { w: 420, h: 297, label: 'A3' },
  letter: { w: 279.4, h: 215.9, label: 'Letter' },
  legal: { w: 355.6, h: 215.9, label: 'Legal' },
  auto: { w: 0, h: 0, label: 'Auto' },
};

const DPI_OPTIONS = [96, 150, 300, 600, 1200];

interface ExportOptions {
  filename: string;
  width: number;
  height: number;
  dpi: number;
  pdfPageSize: PdfPageSize;
  formats: ExportFormat[];
}

export function ExportModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const chartConfig = useChartStore((s) => s.chartConfig);
  const theme = useUiStore((s) => s.theme);
  const addToast = useToastStore((s) => s.addToast);

  const chartType = chartConfig.type;
  const is3D = is3DChart(chartType);

  // Get the Plotly div dimensions for defaults
  const plotDiv = typeof document !== 'undefined' ? document.querySelector('.js-plotly-plot') as HTMLElement | null : null;
  const defaultWidth = plotDiv?.clientWidth ?? 800;
  const defaultHeight = plotDiv?.clientHeight ?? 600;

  const [options, setOptions] = useState<ExportOptions>({
    filename: chartConfig.title || 'chart',
    width: defaultWidth,
    height: defaultHeight,
    dpi: 300,
    pdfPageSize: 'auto',
    formats: ['png'],
  });

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const previewRef = useRef<HTMLImageElement>(null);

  // Update filename when chart title changes
  useEffect(() => {
    setOptions((prev) => ({ ...prev, filename: chartConfig.title || 'chart' }));
  }, [chartConfig.title]);

  const getExportBackground = (): string | undefined => {
    const bg = chartConfig.exportConfig.background;
    if (bg === 'transparent') return undefined;
    if (bg === 'white') return '#ffffff';
    return theme === 'dark' ? '#1e1e32' : '#ffffff';
  };

  // Generate a preview of the chart export
  const generatePreview = async () => {
    try {
      const bgColor = getExportBackground();
      const scale = Math.min(options.dpi / 96, 2); // Limit preview scale for performance

      if (!is3D) {
        const div = document.querySelector('.js-plotly-plot') as HTMLElement | null;
        if (div) {
          const dataUrl = await export2DChartPNGFromSVG(div, {
            scale,
            width: options.width,
            height: options.height,
            backgroundColor: bgColor,
          });
          setPreviewUrl(dataUrl);
          return;
        }
      }

      // 3D preview
      const container3D = document.querySelector('[data-chart-area-3d]') as HTMLElement | null;
      const plotlyDiv3D = container3D?.querySelector('.js-plotly-plot') as HTMLElement | null;
      if (plotlyDiv3D) {
        const dataUrl = await export3DToPng(plotlyDiv3D, chartConfig, {
          scale,
          width: options.width,
          height: options.height,
          backgroundColor: bgColor ?? undefined,
        });
        setPreviewUrl(dataUrl);
      }
    } catch {
      setPreviewUrl(null);
    }
  };

  // Export a single format
  const exportFormat = async (format: ExportFormat) => {
    const bgColor = getExportBackground();
    const filename = options.filename || 'chart';
    const scale = options.dpi / 96;

    if (format === 'png') {
      if (!is3D) {
        const div = document.querySelector('.js-plotly-plot') as HTMLElement | null;
        if (div) {
          const dataUrl = await export2DChartPNGFromSVG(div, {
            scale,
            width: options.width,
            height: options.height,
            backgroundColor: bgColor,
          });
          downloadDataUrl(dataUrl, `${filename}.png`);
          return;
        }
      }
      // 3D PNG
      const container3D = document.querySelector('[data-chart-area-3d]') as HTMLElement | null;
      const plotlyDiv3D = container3D?.querySelector('.js-plotly-plot') as HTMLElement | null;
      if (plotlyDiv3D) {
        const dataUrl = await export3DToPng(plotlyDiv3D, chartConfig, {
          scale,
          width: options.width,
          height: options.height,
          backgroundColor: bgColor ?? undefined,
        });
        downloadDataUrl(dataUrl, `${filename}.png`);
        return;
      }
    }

    if (format === 'svg') {
      if (is3D) {
        addToast(t('toast.svgNotSupported3d'), 'warning');
        return;
      }
      const div = document.querySelector('.js-plotly-plot') as HTMLElement | null;
      if (div) {
        const svgString = await serialize2DChartSVG(div, { backgroundColor: bgColor });
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        downloadBlob(blob, `${filename}.svg`);
        return;
      }
    }

    if (format === 'pdf') {
      const { jsPDF } = await import('jspdf');
      const pageSize = options.pdfPageSize;
      const pageDims = PDF_PAGE_SIZES[pageSize];

      let imgData: string;

      if (!is3D) {
        const div = document.querySelector('.js-plotly-plot') as HTMLElement | null;
        if (div) {
          imgData = await export2DChartPNGFromSVG(div, {
            scale,
            width: options.width,
            height: options.height,
            backgroundColor: bgColor,
          });
        } else {
          return;
        }
      } else {
        const container3D = document.querySelector('[data-chart-area-3d]') as HTMLElement | null;
        const plotlyDiv3D = container3D?.querySelector('.js-plotly-plot') as HTMLElement | null;
        if (plotlyDiv3D) {
          imgData = await export3DToPng(plotlyDiv3D, chartConfig, {
            scale,
            width: options.width,
            height: options.height,
            backgroundColor: bgColor ?? undefined,
          });
        } else {
          return;
        }
      }

      const imgW = options.width;
      const imgH = options.height;
      const aspectRatio = imgW / imgH;

      let pdf;
      if (pageSize === 'auto') {
        const margin = 10;
        const pdfWidth = 297;
        const contentWidth = pdfWidth - 2 * margin;
        const contentHeight = contentWidth / aspectRatio;
        const pdfHeight = contentHeight + 2 * margin;
        pdf = new jsPDF({
          orientation: aspectRatio >= 1 ? 'landscape' : 'portrait',
          unit: 'mm',
          format: [pdfWidth, pdfHeight],
        });
        pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, contentHeight);
      } else {
        const orientation = pageDims.w >= pageDims.h ? 'landscape' : 'portrait';
        pdf = new jsPDF({
          orientation,
          unit: 'mm',
          format: [pageDims.w, pageDims.h],
        });
        const margin = 10;
        const availW = pageDims.w - 2 * margin;
        const availH = pageDims.h - 2 * margin;
        let drawW = availW;
        let drawH = drawW / aspectRatio;
        if (drawH > availH) {
          drawH = availH;
          drawW = drawH * aspectRatio;
        }
        const offsetX = (pageDims.w - drawW) / 2;
        const offsetY = (pageDims.h - drawH) / 2;
        pdf.addImage(imgData, 'PNG', offsetX, offsetY, drawW, drawH);
      }
      pdf.save(`${filename}.pdf`);
      return;
    }

    if (format === 'tiff') {
      const saveTiffBlob = (rgbaData: Uint8Array, w: number, h: number) => {
        const blob = encodeTiff(rgbaData, w, h, options.dpi);
        downloadBlob(blob, `${filename}.tiff`);
      };

      const rgbaFromCanvas = (canvas: HTMLCanvasElement): Uint8Array => {
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Cannot get 2d context');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        return new Uint8Array(imageData.data.buffer);
      };

      let pngDataUrl: string;
      if (!is3D) {
        const div = document.querySelector('.js-plotly-plot') as HTMLElement | null;
        if (!div) return;
        pngDataUrl = await export2DChartPNGFromSVG(div, {
          scale,
          width: options.width,
          height: options.height,
          backgroundColor: bgColor,
        });
      } else {
        const container3D = document.querySelector('[data-chart-area-3d]') as HTMLElement | null;
        const plotlyDiv3D = container3D?.querySelector('.js-plotly-plot') as HTMLElement | null;
        if (!plotlyDiv3D) return;
        pngDataUrl = await export3DToPng(plotlyDiv3D, chartConfig, {
          scale,
          width: options.width,
          height: options.height,
          backgroundColor: bgColor ?? undefined,
        });
      }

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = pngDataUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      if (bgColor) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0);
      saveTiffBlob(rgbaFromCanvas(canvas), canvas.width, canvas.height);
    }
  };

  const handleExport = async () => {
    if (options.formats.length === 0) {
      addToast(t('export.selectAtLeastOneFormat', 'Please select at least one format'), 'warning');
      return;
    }
    setIsExporting(true);
    try {
      for (const fmt of options.formats) {
        await exportFormat(fmt);
      }
      addToast(t('toast.exportSuccess'), 'success');
      onClose();
    } catch {
      addToast(t('toast.exportFailed'), 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const toggleFormat = (fmt: ExportFormat) => {
    setOptions((prev) => ({
      ...prev,
      formats: prev.formats.includes(fmt)
        ? prev.formats.filter((f) => f !== fmt)
        : [...prev.formats, fmt],
    }));
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-input)',
    borderColor: 'var(--border)',
    color: 'var(--text-primary)',
  };

  const labelStyle: React.CSSProperties = {
    color: 'var(--text-secondary)',
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 'var(--z-modal)', background: 'transparent' }} onClick={onClose}>
      <div
        className="rounded-lg shadow-2xl border w-[640px] max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('export.title', 'Export Chart')}</h2>
          <button onClick={onClose} className="transition-colors" style={{ color: 'var(--text-muted)' }} aria-label={t('export.close', 'Close')}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Filename */}
          <div className="space-y-1">
            <label className="text-xs flex items-center gap-2" style={labelStyle}>
              {t('export.filename', 'Filename')}
              <input
                type="text"
                value={options.filename}
                onChange={(e) => setOptions({ ...options, filename: e.target.value })}
                className="flex-1 border rounded px-2 py-1 outline-none text-xs"
                style={inputStyle}
                placeholder={t('export.filenamePlaceholder', 'Enter filename (without extension)')}
              />
            </label>
          </div>

          {/* Dimensions */}
          <div className="space-y-1">
            <div className="text-xs" style={labelStyle}>{t('export.dimensions', 'Dimensions (px)')}</div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs" style={labelStyle}>
                {t('export.width', 'Width')}
                <input
                  type="number"
                  min={100}
                  max={10000}
                  value={options.width}
                  onChange={(e) => setOptions({ ...options, width: Math.max(100, Math.min(10000, Number(e.target.value) || 800)) })}
                  className="w-24 border rounded px-2 py-1 outline-none text-xs"
                  style={inputStyle}
                />
              </label>
              <span style={{ color: 'var(--text-faint)' }}>×</span>
              <label className="flex items-center gap-1 text-xs" style={labelStyle}>
                {t('export.height', 'Height')}
                <input
                  type="number"
                  min={100}
                  max={10000}
                  value={options.height}
                  onChange={(e) => setOptions({ ...options, height: Math.max(100, Math.min(10000, Number(e.target.value) || 600)) })}
                  className="w-24 border rounded px-2 py-1 outline-none text-xs"
                  style={inputStyle}
                />
              </label>
              <button
                onClick={() => setOptions({ ...options, width: defaultWidth, height: defaultHeight })}
                className="text-xs px-2 py-1 rounded transition-colors"
                style={{ color: 'var(--accent)', border: '1px solid var(--border)' }}
              >
                {t('export.resetSize', 'Reset')}
              </button>
            </div>
          </div>

          {/* DPI */}
          <div className="space-y-1">
            <div className="text-xs" style={labelStyle}>{t('export.dpi', 'DPI (Resolution)')}</div>
            <div className="flex items-center gap-2">
              <select
                value={options.dpi}
                onChange={(e) => setOptions({ ...options, dpi: Number(e.target.value) })}
                className="border rounded px-2 py-1 outline-none text-xs"
                style={inputStyle}
              >
                {DPI_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d} DPI</option>
                ))}
              </select>
              <input
                type="number"
                min={72}
                max={2400}
                value={options.dpi}
                onChange={(e) => setOptions({ ...options, dpi: Math.max(72, Math.min(2400, Number(e.target.value) || 300)) })}
                className="w-24 border rounded px-2 py-1 outline-none text-xs"
                style={inputStyle}
              />
            </div>
          </div>

          {/* PDF page size */}
          <div className="space-y-1">
            <div className="text-xs" style={labelStyle}>{t('export.pdfPageSize', 'PDF Page Size')}</div>
            <select
              value={options.pdfPageSize}
              onChange={(e) => setOptions({ ...options, pdfPageSize: e.target.value as PdfPageSize })}
              className="border rounded px-2 py-1 outline-none text-xs"
              style={inputStyle}
            >
              <option value="auto">{t('export.pageSizeAuto', 'Auto (fit to chart)')}</option>
              <option value="a4">A4 (297 × 210 mm)</option>
              <option value="a3">A3 (420 × 297 mm)</option>
              <option value="letter">Letter (8.5 × 11 in)</option>
              <option value="legal">Legal (8.5 × 14 in)</option>
            </select>
          </div>

          {/* Formats */}
          <div className="space-y-1">
            <div className="text-xs" style={labelStyle}>{t('export.formats', 'Export Formats (batch)')}</div>
            <div className="flex items-center gap-2 flex-wrap">
              {(['png', 'svg', 'pdf', 'tiff'] as ExportFormat[]).map((fmt) => (
                <label key={fmt} className="flex items-center gap-1 text-xs cursor-pointer" style={labelStyle}>
                  <input
                    type="checkbox"
                    checked={options.formats.includes(fmt)}
                    onChange={() => toggleFormat(fmt)}
                    className="accent-sky-500"
                    disabled={fmt === 'svg' && is3D}
                  />
                  <span style={{ opacity: fmt === 'svg' && is3D ? 0.5 : 1 }}>{fmt.toUpperCase()}</span>
                </label>
              ))}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-faint)' }}>
              {t('export.batchHint', 'Select multiple formats to export them all at once.')}
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="text-xs" style={labelStyle}>{t('export.preview', 'Preview')}</div>
              <button
                onClick={generatePreview}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors"
                style={{ color: 'var(--accent)', border: '1px solid var(--border)' }}
              >
                <Eye size={12} />
                {t('export.generatePreview', 'Generate')}
              </button>
            </div>
            <div
              className="border rounded p-2 flex items-center justify-center"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-input)', minHeight: 120 }}
            >
              {previewUrl ? (
                <img
                  ref={previewRef}
                  src={previewUrl}
                  alt={t('export.preview', 'Preview')}
                  className="max-w-full max-h-[200px] object-contain"
                />
              ) : (
                <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
                  {t('export.previewHint', 'Click "Generate" to preview the export.')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded transition-colors"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            {t('export.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || options.formats.length === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded transition-colors disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <Download size={12} />
            {isExporting ? t('export.exporting', 'Exporting…') : t('export.export', 'Export')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = URL.createObjectURL(blob);
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
