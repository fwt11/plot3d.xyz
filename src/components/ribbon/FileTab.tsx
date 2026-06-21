import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useUiStore, useDatasetStore, useChartStore, useHistoryStore } from '@/store/plotStore';
import { is3DChart } from '@/utils/chart';
import { FileUp, Download, Save, FolderOpen } from 'lucide-react';
import type { Dataset } from '@/types';
import { uid } from '@/utils/sampleData';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import Plotly from 'plotly.js-dist-min';
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
import { RibbonGroup } from './RibbonGroup';
import { serializeProject, loadProjectFile, saveProjectFile } from '@/utils/projectFile';

export function FileTab() {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const addDataset = useDatasetStore((s) => s.addDataset);
  const exportConfig = useChartStore((s) => s.chartConfig.exportConfig);
  const chartType = useChartStore((s) => s.chartConfig.type);
  const theme = useUiStore((s) => s.theme);

  const getExportBackground = (): string | undefined => {
    if (exportConfig.background === 'transparent') return undefined;
    if (exportConfig.background === 'white') return '#ffffff';
    return theme === 'dark' ? '#1e1e32' : '#ffffff';
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
          if (rows.length < 2) return;
          const headers = rows[0];
          const columns: Dataset['columns'] = headers.map((h, i) => ({
            id: uid(), name: h || `Col${i + 1}`, type: i === 0 ? 'X' : i === 1 ? 'Y' : 'Z',
            values: rows.slice(1).map((row) => row[i] ?? ''),
          }));
          addDataset({ id: uid(), name: file.name.replace(/\.csv$/i, ''), columns });
        },
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
        if (rows.length < 2) return;
        const headers = rows[0];
        const columns: Dataset['columns'] = headers.map((h, i) => ({
          id: uid(), name: String(h || `Col${i + 1}`), type: i === 0 ? 'X' : i === 1 ? 'Y' : 'Z',
          values: rows.slice(1).map((row) => row[i] ?? ''),
        }));
        addDataset({ id: uid(), name: file.name.replace(/\.xlsx?$/i, ''), columns });
      };
      reader.readAsBinaryString(file);
    }
    e.target.value = '';
  };

  const getPlotlyDiv = (): HTMLElement | null => {
    return document.querySelector('.js-plotly-plot');
  };

  const handleExportPNG = async () => {
    const is3D = is3DChart(chartType);
    const bgColor = getExportBackground();

    if (!is3D) {
      // Use Plotly's native PNG export for 2D charts
      const div = getPlotlyDiv();
      if (div) {
        const scale = exportConfig.resolutionMultiplier;
        const dataUrl = await Plotly.toImage(div, {
          format: 'png',
          scale,
          width: div.clientWidth * scale / (window.devicePixelRatio || 1),
          height: div.clientHeight * scale / (window.devicePixelRatio || 1),
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
  };

  const handleExportSVG = async () => {
    const is3D = is3DChart(chartType);

    if (!is3D) {
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
        return;
      }
    }
  };

  const handleExportPDF = async () => {
    const is3D = is3DChart(chartType);
    const bgColor = getExportBackground();
    let imgData: string;
    let imgWidth: number;
    let imgHeight: number;

    if (!is3D) {
      // Use Plotly's native export for 2D
      const div = getPlotlyDiv();
      if (div) {
        const scale = exportConfig.resolutionMultiplier;
        imgData = await Plotly.toImage(div, {
          format: 'png',
          scale,
          bgcolor: bgColor ?? 'rgba(0,0,0,0)',
        });
        imgWidth = div.clientWidth * scale;
        imgHeight = div.clientHeight * scale;
      } else {
        return;
      }
    } else {
      // 3D: capture entire container (canvas + overlays) using html-to-image
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
          // Fall through to canvas-only export
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
        // Fallback: canvas-only export
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
    }

    // Match PDF page size to chart aspect ratio
    const aspectRatio = imgWidth / imgHeight;
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
    pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, contentHeight);
    pdf.save('chart.pdf');
  };

  const handleExportEPS = async () => {
    const is3D = is3DChart(chartType);
    const bgColor = getExportBackground();

    if (!is3D) {
      // 2D: export SVG via Plotly, then wrap in a basic EPS header
      const div = getPlotlyDiv();
      if (div) {
        const dataUrl = await Plotly.toImage(div, {
          format: 'svg',
          scale: exportConfig.resolutionMultiplier,
          bgcolor: bgColor ?? 'rgba(0,0,0,0)',
        });
        // dataUrl is a data URI: data:image/svg+xml;charset=utf-8,...
        const svgText = decodeURIComponent(dataUrl.split(',')[1]);
        const epsContent =
          '%!PS-Adobe-3.0 EPSF-3.0\n' +
          `%%BoundingBox: 0 0 ${div.clientWidth} ${div.clientHeight}\n` +
          '%%EndComments\n' +
          svgText +
          '\n%%EOF\n';
        const blob = new Blob([epsContent], { type: 'application/postscript' });
        const link = document.createElement('a');
        link.download = 'chart.eps';
        link.href = URL.createObjectURL(blob);
        link.click();
        return;
      }
    }

    // 3D: fallback to high-res PNG (3D cannot produce vector EPS)
    const container3D = document.querySelector('[data-chart-area-3d]') as HTMLElement | null;
    if (container3D) {
      try {
        const dataUrl = await toPng(container3D, {
          pixelRatio: exportConfig.resolutionMultiplier,
          backgroundColor: bgColor ?? undefined,
        });
        const link = document.createElement('a');
        link.download = 'chart.eps';
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
      link.download = 'chart.eps';
      link.href = scaledCanvas.toDataURL('image/png');
      link.click();
    }
  };

  const handleExportTIFF = async () => {
    const is3D = is3DChart(chartType);
    const bgColor = getExportBackground();

    // NOTE: Browsers cannot natively create real TIFF files.
    // This exports a high-resolution PNG and saves it with a .tiff extension.
    if (!is3D) {
      // 2D: use Plotly's PNG export at high resolution (scale=4 for ~300 DPI equivalent)
      const div = getPlotlyDiv();
      if (div) {
        const scale = 4;
        const dataUrl = await Plotly.toImage(div, {
          format: 'png',
          scale,
          width: div.clientWidth * scale / (window.devicePixelRatio || 1),
          height: div.clientHeight * scale / (window.devicePixelRatio || 1),
          bgcolor: bgColor ?? 'rgba(0,0,0,0)',
        });
        const link = document.createElement('a');
        link.download = 'chart.tiff';
        link.href = dataUrl;
        link.click();
        return;
      }
    }

    // 3D: use html-to-image with high pixelRatio
    const container3D = document.querySelector('[data-chart-area-3d]') as HTMLElement | null;
    if (container3D) {
      try {
        const dataUrl = await toPng(container3D, {
          pixelRatio: 4,
          backgroundColor: bgColor ?? undefined,
        });
        const link = document.createElement('a');
        link.download = 'chart.tiff';
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
      const multiplier = 4;
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
      link.download = 'chart.tiff';
      link.href = scaledCanvas.toDataURL('image/png');
      link.click();
    }
  };

  const handleExportCSV = () => {
    const datasets = useDatasetStore.getState().datasets;
    const ds = datasets.find((d) => d.id === useDatasetStore.getState().activeDatasetId);
    if (!ds) return;
    const headers = ds.columns.map((c) => c.name);
    const maxRows = Math.max(...ds.columns.map((c) => c.values.length), 0);
    const rows = Array.from({ length: maxRows }, (_, i) =>
      ds.columns.map((c) => String(c.values[i] ?? ''))
    );
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.download = `${ds.name}.csv`;
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  const handleSaveProject = () => {
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
  };

  const handleLoadProject = () => {
    projectInputRef.current?.click();
  };

  const handleProjectFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const project = await loadProjectFile(file);
    if (!project) return;

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
      useUiStore.getState().toggleTheme(); // toggle if needed
      if (useUiStore.getState().theme !== project.theme) {
        useUiStore.getState().toggleTheme();
      }
    }
    if (project.lang) {
      useUiStore.getState().setLang(project.lang);
    }
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
        <button onClick={handleExportEPS} className="ribbon-btn" title={t('file.exportEps')} aria-label={t('file.exportEps')}>
          <Download size={16} />
          <span className="text-xs">EPS</span>
        </button>
        <button onClick={handleExportTIFF} className="ribbon-btn" title={t('file.exportTiff')} aria-label={t('file.exportTiff')}>
          <Download size={16} />
          <span className="text-xs">TIFF</span>
        </button>
      </RibbonGroup>
    </div>
  );
}
