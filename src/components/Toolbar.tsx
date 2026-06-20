import { usePlotStore } from '@/store/plotStore';
import {
  FileUp, Download, Undo2, Redo2, RotateCcw,
  Sun, Eye, Droplets, Palette,
} from 'lucide-react';
import { getColorMapGradient } from '@/utils/colormaps';
import type { ColorMapName } from '@/types';
import { useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { uid } from '@/utils/sampleData';
import type { Dataset } from '@/types';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

const colorMapNames: ColorMapName[] = ['jet', 'viridis', 'hot', 'coolwarm', 'parula', 'plasma'];

export default function Toolbar() {
  const chartConfig = usePlotStore((s) => s.chartConfig);
  const scene3D = usePlotStore((s) => s.scene3D);
  const addDataset = usePlotStore((s) => s.addDataset);
  const setScene3D = usePlotStore((s) => s.setScene3D);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = () => {
    fileInputRef.current?.click();
  };

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
            id: uid(),
            name: h || `Col${i + 1}`,
            type: i === 0 ? 'X' : i === 1 ? 'Y' : 'Z',
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
          id: uid(),
          name: String(h || `Col${i + 1}`),
          type: i === 0 ? 'X' : i === 1 ? 'Y' : 'Z',
          values: rows.slice(1).map((row) => row[i] ?? ''),
        }));
        addDataset({ id: uid(), name: file.name.replace(/\.xlsx?$/i, ''), columns });
      };
      reader.readAsBinaryString(file);
    }

    e.target.value = '';
  };

  const handleExportPNG = async () => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.download = 'chart.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } else {
      const chartArea = document.querySelector('[data-chart-area]') as HTMLElement;
      if (chartArea) {
        const dataUrl = await toPng(chartArea);
        const link = document.createElement('a');
        link.download = 'chart.png';
        link.href = dataUrl;
        link.click();
      }
    }
  };

  const handleExportPDF = async () => {
    const canvas = document.querySelector('canvas');
    let imgData: string;
    if (canvas) {
      imgData = canvas.toDataURL('image/png');
    } else {
      const chartArea = document.querySelector('[data-chart-area]') as HTMLElement;
      if (!chartArea) return;
      imgData = await toPng(chartArea);
    }
    const pdf = new jsPDF('landscape', 'mm', 'a4');
    pdf.addImage(imgData, 'PNG', 10, 10, 277, 190);
    pdf.save('chart.pdf');
  };

  const handleExportCSV = () => {
    const datasets = usePlotStore.getState().datasets;
    const ds = datasets.find((d) => d.id === usePlotStore.getState().activeDatasetId);
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

  const is3D = ['surface3d', 'scatter3d', 'contour3d', 'bar3d'].includes(chartConfig.type);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/80 border-b border-zinc-700/50">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleFileChange}
        className="hidden"
      />

      <button onClick={handleImport} className="toolbar-btn" title="导入数据">
        <FileUp size={16} />
        <span className="hidden sm:inline">导入</span>
      </button>

      <div className="w-px h-5 bg-zinc-700" />

      <button onClick={handleExportPNG} className="toolbar-btn" title="导出 PNG">
        <Download size={16} />
        <span className="hidden sm:inline">PNG</span>
      </button>

      <button onClick={handleExportPDF} className="toolbar-btn" title="导出 PDF">
        <Download size={16} />
        <span className="hidden sm:inline">PDF</span>
      </button>

      <button onClick={handleExportCSV} className="toolbar-btn" title="导出 CSV">
        <Download size={16} />
        <span className="hidden sm:inline">CSV</span>
      </button>

      <div className="w-px h-5 bg-zinc-700" />

      {is3D && (
        <>
          <div className="flex items-center gap-1.5">
            <Sun size={14} className="text-zinc-500" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={scene3D.ambientIntensity}
              onChange={(e) => setScene3D({ ambientIntensity: Number(e.target.value) })}
              className="w-16 accent-sky-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Droplets size={14} className="text-zinc-500" />
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={scene3D.opacity}
              onChange={(e) => setScene3D({ opacity: Number(e.target.value) })}
              className="w-16 accent-sky-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Palette size={14} className="text-zinc-500" />
            <div className="flex gap-0.5">
              {colorMapNames.map((name) => (
                <button
                  key={name}
                  onClick={() => setScene3D({ colorMap: name })}
                  className={`w-5 h-3 rounded-sm border transition-all ${
                    scene3D.colorMap === name ? 'border-sky-400 scale-110' : 'border-zinc-600'
                  }`}
                  style={{ background: getColorMapGradient(name) }}
                  title={name}
                />
              ))}
            </div>
          </div>

          <button
            onClick={() => setScene3D({ cameraPosition: [3, 3, 3] })}
            className="toolbar-btn"
            title="重置视角"
          >
            <RotateCcw size={14} />
          </button>

          <button
            onClick={() => setScene3D({ showAxes: !scene3D.showAxes })}
            className={`toolbar-btn ${scene3D.showAxes ? 'text-sky-400' : ''}`}
            title="显示/隐藏坐标轴"
          >
            <Eye size={14} />
          </button>
        </>
      )}
    </div>
  );
}
