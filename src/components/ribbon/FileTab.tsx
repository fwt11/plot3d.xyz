import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUiStore, useDatasetStore, useChartStore, useHistoryStore } from '@/store/plotStore';
import { useToastStore } from '@/store/toastStore';
import { is3DChart } from '@/utils/chart';
import { FileUp, Download, Save, FolderOpen, Settings } from 'lucide-react';
import type { Dataset } from '@/types';
import { uid } from '@/utils/sampleData';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import Plotly from 'plotly.js-dist-min';
import { toPng } from 'html-to-image';
import { RibbonGroup } from './RibbonGroup';
import { serializeProject, loadProjectFile, saveProjectFile } from '@/utils/projectFile';
import { encodeTiff } from '@/utils/tiffEncoder';
import { ExportModal } from '@/components/ExportModal';

export function FileTab() {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const addDataset = useDatasetStore((s) => s.addDataset);
  const exportConfig = useChartStore((s) => s.chartConfig.exportConfig);
  const chartType = useChartStore((s) => s.chartConfig.type);
  const theme = useUiStore((s) => s.theme);
  const addToast = useToastStore((s) => s.addToast);

  const getExportBackground = (): string | undefined => {
    if (exportConfig.background === 'transparent') return undefined;
    if (exportConfig.background === 'white') return '#ffffff';
    return theme === 'dark' ? '#1e1e32' : '#ffffff';
  };

  const runExport = async (fn: () => Promise<void>) => {
    try {
      await fn();
      addToast(t('toast.exportSuccess'), 'success');
    } catch {
      addToast(t('toast.exportFailed'), 'error');
    }
  };

  const handleImport = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
      Papa.parse(file, {
        complete: (results) => {
          const rows = results.data as string[][];
          if (rows.length < 2) {
            addToast(t('toast.importTooFewRows'), 'warning');
            return;
          }
          const headers = rows[0];
          const columns: Dataset['columns'] = headers.map((h, i) => ({
            id: uid(), name: h || `Col${i + 1}`, type: i === 0 ? 'X' : i === 1 ? 'Y' : 'Z',
            values: rows.slice(1).map((row) => row[i] ?? ''),
          }));
          addDataset({ id: uid(), name: file.name.replace(/\.csv$/i, ''), columns });
          addToast(t('toast.importSuccess', { file: file.name }), 'success');
        },
        error: () => {
          addToast(t('toast.importFailed', { file: file.name }), 'error');
        },
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = evt.target?.result;
          const wb = XLSX.read(data, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1 });
          if (rows.length < 2) {
            addToast(t('toast.importTooFewRows'), 'warning');
            return;
          }
          const headers = rows[0];
          const columns: Dataset['columns'] = headers.map((h, i) => ({
            id: uid(), name: String(h || `Col${i + 1}`), type: i === 0 ? 'X' : i === 1 ? 'Y' : 'Z',
            values: rows.slice(1).map((row) => row[i] ?? ''),
          }));
          addDataset({ id: uid(), name: file.name.replace(/\.xlsx?$/i, ''), columns });
          addToast(t('toast.importSuccess', { file: file.name }), 'success');
        } catch {
          addToast(t('toast.importFailed', { file: file.name }), 'error');
        }
      };
      reader.onerror = () => addToast(t('toast.importFailed', { file: file.name }), 'error');
      reader.readAsArrayBuffer(file);
    }
    e.target.value = '';
  };

  const getPlotlyDiv = (): HTMLElement | null => {
    return document.querySelector('.js-plotly-plot');
  };

  const handleExportPNG = async () => runExport(async () => {
    const is3D = is3DChart(chartType);
    const bgColor = getExportBackground();

    if (!is3D) {
      // Use Plotly's native PNG export for 2D charts
      const div = getPlotlyDiv();
      if (div) {
        const dataUrl = await Plotly.toImage(div, {
          format: 'png',
          scale: exportConfig.resolutionMultiplier,
          bgcolor: bgColor ?? 'rgba(0,0,0,0)',
        });
        const link = document.createElement('a');
        link.download = 'chart.png';
        link.href = dataUrl;
        link.click();
        return;
      }
    }

    // 3D: capture entire container (canvas + overlays) using html-to-image
    const container3D = document.querySelector('[data-chart-area-3d]') as HTMLElement | null;
    if (container3D) {
      try {
        const dataUrl = await toPng(container3D, {
          pixelRatio: exportConfig.resolutionMultiplier,
          backgroundColor: bgColor ?? undefined,
        });
        const link = document.createElement('a');
        link.download = 'chart.png';
        link.href = dataUrl;
        link.click();
        return;
      } catch {
        // Fall through to canvas-only export
      }
    }

    // Fallback for 3D: canvas-only export
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const multiplier = exportConfig.resolutionMultiplier;
      const width = canvas.width;
      const height = canvas.height;
      const scaledCanvas = document.createElement('canvas');
      scaledCanvas.width = width * multiplier;
      scaledCanvas.height = height * multiplier;
      const ctx = scaledCanvas.getContext('2d');
      if (!ctx) return;
      if (bgColor) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, scaledCanvas.width, scaledCanvas.height);
      }
      ctx.scale(multiplier, multiplier);
      ctx.drawImage(canvas, 0, 0, width, height);
      const link = document.createElement('a');
      link.download = 'chart.png';
      link.href = scaledCanvas.toDataURL('image/png');
      link.click();
    }
  });

  const handleExportSVG = async () => {
    const is3D = is3DChart(chartType);

    if (is3D) {
      addToast(t('toast.svgNotSupported3d', 'SVG export is not supported for 3D charts'), 'warning');
      return;
    }

    runExport(async () => {
      // Use Plotly's native SVG export for 2D charts
      const div = getPlotlyDiv();
      if (div) {
        const dataUrl = await Plotly.toImage(div, {
          format: 'svg',
          scale: exportConfig.resolutionMultiplier,
          bgcolor: getExportBackground() ?? 'rgba(0,0,0,0)',
        });
        const link = document.createElement('a');
        link.download = 'chart.svg';
        link.href = dataUrl;
        link.click();
      }
    });
  };

  const handleExportPDF = async () => runExport(async () => {
    const is3D = is3DChart(chartType);
    const bgColor = getExportBackground();

    if (!is3D) {
      // 2D: export vector SVG from Plotly, embed into a vector PDF
      const div = getPlotlyDiv();
      if (div) {
        const svgDataUrl = await Plotly.toImage(div, {
          format: 'svg',
          scale: exportConfig.resolutionMultiplier,
          bgcolor: bgColor ?? 'rgba(0,0,0,0)',
        });
        // svgDataUrl is a data: URL; decode to raw SVG string
        const svgString = decodeURIComponent(svgDataUrl.split(',')[1] ?? '');
        const { jsPDF } = await import('jspdf');
        // Match page size to the chart's aspect ratio
        const width = div.clientWidth;
        const height = div.clientHeight;
        const aspectRatio = width / height;
        const margin = 10;
        const pdfWidth = 297;
        const contentWidth = pdfWidth - 2 * margin;
        const contentHeight = contentWidth / aspectRatio;
        const pdfHeight = contentHeight + 2 * margin;
        const pdf = new jsPDF({
          orientation: aspectRatio >= 1 ? 'landscape' : 'portrait',
          unit: 'mm',
          format: [pdfWidth, pdfHeight],
        });
        // Embed SVG as a vector image (text stays selectable, scales losslessly)
        await pdf.addSvgAsImage(svgString, margin, margin, contentWidth, contentHeight);
        pdf.save('chart.pdf');
        return;
      }
    }

    // 3D: fall back to raster PNG embedded in PDF (3D cannot produce vector output)
    let imgData: string;
    let imgWidth: number;
    let imgHeight: number;
    const container3D = document.querySelector('[data-chart-area-3d]') as HTMLElement | null;
    if (container3D) {
      try {
        imgData = await toPng(container3D, {
          pixelRatio: exportConfig.resolutionMultiplier,
          backgroundColor: bgColor ?? undefined,
        });
        imgWidth = container3D.clientWidth * exportConfig.resolutionMultiplier;
        imgHeight = container3D.clientHeight * exportConfig.resolutionMultiplier;
      } catch {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;
        const multiplier = exportConfig.resolutionMultiplier;
        const width = canvas.width;
        const height = canvas.height;
        const scaledCanvas = document.createElement('canvas');
        scaledCanvas.width = width * multiplier;
        scaledCanvas.height = height * multiplier;
        const ctx = scaledCanvas.getContext('2d');
        if (!ctx) return;
        if (bgColor) {
          ctx.fillStyle = bgColor;
          ctx.fillRect(0, 0, scaledCanvas.width, scaledCanvas.height);
        }
        ctx.scale(multiplier, multiplier);
        ctx.drawImage(canvas, 0, 0, width, height);
        imgData = scaledCanvas.toDataURL('image/png');
        imgWidth = scaledCanvas.width;
        imgHeight = scaledCanvas.height;
      }
    } else {
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      const multiplier = exportConfig.resolutionMultiplier;
      const width = canvas.width;
      const height = canvas.height;
      const scaledCanvas = document.createElement('canvas');
      scaledCanvas.width = width * multiplier;
      scaledCanvas.height = height * multiplier;
      const ctx = scaledCanvas.getContext('2d');
      if (!ctx) return;
      if (bgColor) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, scaledCanvas.width, scaledCanvas.height);
      }
      ctx.scale(multiplier, multiplier);
      ctx.drawImage(canvas, 0, 0, width, height);
      imgData = scaledCanvas.toDataURL('image/png');
      imgWidth = scaledCanvas.width;
      imgHeight = scaledCanvas.height;
    }

    const aspectRatio = imgWidth / imgHeight;
    const margin = 10;
    const pdfWidth = 297;
    const contentWidth = pdfWidth - 2 * margin;
    const contentHeight = contentWidth / aspectRatio;
    const pdfHeight = contentHeight + 2 * margin;
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({
      orientation: aspectRatio >= 1 ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [pdfWidth, pdfHeight],
    });
    pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, contentHeight);
    pdf.save('chart.pdf');
  });

  const handleExportTIFF = async () => runExport(async () => {
    const is3D = is3DChart(chartType);
    const bgColor = getExportBackground();
    const dpi = 300;

    const saveTiffBlob = (rgbaData: Uint8Array, w: number, h: number) => {
      const blob = encodeTiff(rgbaData, w, h, dpi);
      const link = document.createElement('a');
      link.download = 'chart.tiff';
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
    };

    const rgbaFromCanvas = (canvas: HTMLCanvasElement): Uint8Array => {
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Cannot get 2d context');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return new Uint8Array(imageData.data.buffer);
    };

    if (!is3D) {
      // 2D: use Plotly's PNG export, draw on canvas to get RGBA, then encode as TIFF
      const div = getPlotlyDiv();
      if (div) {
        const scale = dpi / 96; // 96 DPI is screen default
        const dataUrl = await Plotly.toImage(div, {
          format: 'png',
          scale,
          bgcolor: bgColor ?? 'rgba(0,0,0,0)',
        });
        // Decode PNG via Image + Canvas to get raw RGBA
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to load image'));
          img.src = dataUrl;
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
        const rgbaData = rgbaFromCanvas(canvas);
        saveTiffBlob(rgbaData, canvas.width, canvas.height);
        return;
      }
    }

    // 3D: capture via html-to-image or canvas, then encode as TIFF
    const container3D = document.querySelector('[data-chart-area-3d]') as HTMLElement | null;
    if (container3D) {
      try {
        const dataUrl = await toPng(container3D, {
          pixelRatio: dpi / 96,
          backgroundColor: bgColor ?? undefined,
        });
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to load image'));
          img.src = dataUrl;
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
        const rgbaData = rgbaFromCanvas(canvas);
        saveTiffBlob(rgbaData, canvas.width, canvas.height);
        return;
      } catch {
        // Fall through to canvas-only export
      }
    }

    // Fallback for 3D: canvas-only export
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const multiplier = dpi / 96;
      const width = canvas.width;
      const height = canvas.height;
      const scaledCanvas = document.createElement('canvas');
      scaledCanvas.width = width * multiplier;
      scaledCanvas.height = height * multiplier;
      const ctx = scaledCanvas.getContext('2d');
      if (!ctx) return;
      if (bgColor) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, scaledCanvas.width, scaledCanvas.height);
      }
      ctx.scale(multiplier, multiplier);
      ctx.drawImage(canvas, 0, 0, width, height);
      const rgbaData = rgbaFromCanvas(scaledCanvas);
      saveTiffBlob(rgbaData, scaledCanvas.width, scaledCanvas.height);
    }
  });

  const handleExportCSV = () => {
    const datasets = useDatasetStore.getState().datasets;
    const ds = datasets.find((d) => d.id === useDatasetStore.getState().activeDatasetId);
    if (!ds) {
      addToast(t('toast.noDatasetForExport'), 'warning');
      return;
    }
    const headers = ds.columns.map((c) => c.name);
    const maxRows = Math.max(...ds.columns.map((c) => c.values.length), 0);
    const rows = Array.from({ length: maxRows }, (_, i) =>
      ds.columns.map((c) => String(c.values[i] ?? ''))
    );
    const csv = Papa.unparse({ fields: headers, data: rows });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.download = `${ds.name}.csv`;
    link.href = URL.createObjectURL(blob);
    link.click();
    addToast(t('toast.exportSuccess'), 'success');
  };

  const handleSaveProject = () => {
    try {
      const dsState = useDatasetStore.getState();
      const chartState = useChartStore.getState();
      const uiState = useUiStore.getState();
      const project = serializeProject({
        datasets: dsState.datasets,
        chartConfig: chartState.chartConfig,
        theme: uiState.theme,
        lang: uiState.lang,
      });
      const title = chartState.chartConfig.title || 'untitled';
      saveProjectFile(project, title);
      addToast(t('toast.projectSaved'), 'success');
    } catch {
      addToast(t('toast.projectSaveFailed'), 'error');
    }
  };

  const handleLoadProject = () => {
    projectInputRef.current?.click();
  };

  const handleProjectFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const project = await loadProjectFile(file);
    if (!project) {
      addToast(t('toast.projectLoadFailed'), 'error');
      return;
    }

    // Restore all stores
    useDatasetStore.setState({
      datasets: project.datasets,
      activeDatasetId: project.datasets[0]?.id ?? null,
    });
    useChartStore.setState({
      chartConfig: project.chartConfig,
    });
    // Clear history after loading a project
    useHistoryStore.setState({ _past: [], _future: [] });
    if (project.theme) {
      useUiStore.getState().setTheme(project.theme);
    }
    if (project.lang) {
      useUiStore.getState().setLang(project.lang);
    }
    addToast(t('toast.projectLoaded', { file: file.name }), 'success');
    e.target.value = '';
  };

  return (
    <div className="flex items-stretch">
      <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} className="hidden" />
      <input ref={projectInputRef} type="file" accept=".plot3d,.json" onChange={handleProjectFileChange} className="hidden" />
      <RibbonGroup label={t('file.project')}>
        <button onClick={handleSaveProject} className="ribbon-btn" title={t('file.saveProject')} aria-label={t('file.saveProject')}>
          <Save size={16} />
          <span className="text-xs">{t('file.saveProject')}</span>
        </button>
        <button onClick={handleLoadProject} className="ribbon-btn" title={t('file.loadProject')} aria-label={t('file.loadProject')}>
          <FolderOpen size={16} />
          <span className="text-xs">{t('file.loadProject')}</span>
        </button>
      </RibbonGroup>
      <RibbonGroup label={t('file.import')}>
        <button onClick={handleImport} className="ribbon-btn" title={t('file.importCsvExcel')} aria-label={t('file.importData')}>
          <FileUp size={16} />
          <span className="text-xs">{t('file.importData')}</span>
        </button>
      </RibbonGroup>
      <RibbonGroup label={t('file.export')}>
        <button onClick={handleExportPNG} className="ribbon-btn" title={t('file.exportPng')} aria-label={t('file.exportPng')}>
          <Download size={16} />
          <span className="text-xs">PNG</span>
        </button>
        <button onClick={handleExportSVG} className="ribbon-btn" title={t('file.exportSvg')} aria-label={t('file.exportSvg')}>
          <Download size={16} />
          <span className="text-xs">SVG</span>
        </button>
        <button onClick={handleExportPDF} className="ribbon-btn" title={t('file.exportPdf')} aria-label={t('file.exportPdf')}>
          <Download size={16} />
          <span className="text-xs">PDF</span>
        </button>
        <button onClick={handleExportCSV} className="ribbon-btn" title={t('file.exportCsv')} aria-label={t('file.exportCsv')}>
          <Download size={16} />
          <span className="text-xs">CSV</span>
        </button>
        <button onClick={handleExportTIFF} className="ribbon-btn" title={t('file.exportTiff')} aria-label={t('file.exportTiff')}>
          <Download size={16} />
          <span className="text-xs">TIFF</span>
        </button>
        <button onClick={() => setShowExportModal(true)} className="ribbon-btn" title={t('file.exportAdvanced', 'Advanced Export')} aria-label={t('file.exportAdvanced', 'Advanced Export')}>
          <Settings size={16} />
          <span className="text-xs">{t('file.exportAdvanced', 'Advanced')}</span>
        </button>
      </RibbonGroup>
      {showExportModal && <ExportModal onClose={() => setShowExportModal(false)} />}
    </div>
  );
}
