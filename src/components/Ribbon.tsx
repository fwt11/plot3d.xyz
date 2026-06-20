import { useState, useRef } from 'react';
import { usePlotStore } from '@/store/plotStore';
import {
  FileUp, Download, Database, Sun, Droplets, Palette, RotateCcw, Eye,
  LineChart, BarChart3, ScatterChart, AreaChart, PieChart,
  Box, Rotate3D, Mountain, Binary, Compass,
  Type, ArrowUpRight, Square, Sigma, Trash2, EyeOff, Plus,
  ChevronDown, ChevronRight,
  FunctionSquare, ArrowUpDown, Minimize2, Calculator, Hash, TrendingUp, Activity, Waves, Zap,
  Moon, SunMoon, Circle,
} from 'lucide-react';
import { getColorMapGradient } from '@/utils/colormaps';
import type { ColorMapName, ChartType, AnnotationType, Annotation } from '@/types';
import { uid } from '@/utils/sampleData';
import type { Dataset } from '@/types';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import {
  createSampleSineDataset,
  createSampleSurfaceDataset,
  createSampleScatter3DDataset,
  createSampleBarDataset,
} from '@/utils/sampleData';
import type { AxisConfig } from '@/types';

// ─── Ribbon Tab Types ───────────────────────────────────────────
type RibbonTab = 'file' | 'generate' | 'transform' | 'chart' | 'annotation';

const chartTypes: { type: ChartType; label: string; icon: React.ReactNode; group: '2d' | '3d' }[] = [
  { type: 'line', label: '折线图', icon: <LineChart size={18} />, group: '2d' },
  { type: 'scatter', label: '散点图', icon: <ScatterChart size={18} />, group: '2d' },
  { type: 'bar', label: '柱状图', icon: <BarChart3 size={18} />, group: '2d' },
  { type: 'area', label: '面积图', icon: <AreaChart size={18} />, group: '2d' },
  { type: 'pie', label: '饼图', icon: <PieChart size={18} />, group: '2d' },
  { type: 'polar', label: '极坐标', icon: <Compass size={18} />, group: '2d' },
  { type: 'surface3d', label: '3D 曲面', icon: <Mountain size={18} />, group: '3d' },
  { type: 'scatter3d', label: '3D 散点', icon: <Rotate3D size={18} />, group: '3d' },
  { type: 'contour3d', label: '等高线', icon: <Binary size={18} />, group: '3d' },
  { type: 'bar3d', label: '3D 柱状', icon: <Box size={18} />, group: '3d' },
];

const colorMapNames: ColorMapName[] = ['jet', 'viridis', 'hot', 'coolwarm', 'parula', 'plasma'];

const annotationTypes: { type: AnnotationType; label: string; icon: React.ReactNode }[] = [
  { type: 'text', label: '文本', icon: <Type size={16} /> },
  { type: 'latex', label: 'LaTeX', icon: <Sigma size={16} /> },
  { type: 'arrow', label: '箭头', icon: <ArrowUpRight size={16} /> },
  { type: 'rect', label: '矩形', icon: <Square size={16} /> },
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
  if (type === 'arrow') return { ...base, content: '', arrowTo: { x: 70, y: 30 } };
  if (type === 'rect') return { ...base, content: '', rectSize: { w: 20, h: 15 } };
  return base;
}

// ─── Ribbon Group Component ─────────────────────────────────────
function RibbonGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center border-r px-3 py-1.5 last:border-r-0" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-2 flex-1">{children}</div>
      <span className="text-[10px] mt-0.5 select-none" style={{ color: 'var(--text-faint)' }}>{label}</span>
    </div>
  );
}

// ─── File Tab ───────────────────────────────────────────────────
function FileTab() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addDataset = usePlotStore((s) => s.addDataset);
  const theme = usePlotStore((s) => s.theme);
  const toggleTheme = usePlotStore((s) => s.toggleTheme);

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

  return (
    <div className="flex items-stretch">
      <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} className="hidden" />
      <RibbonGroup label="导入">
        <button onClick={handleImport} className="ribbon-btn" title="导入 CSV / Excel">
          <FileUp size={20} />
          <span className="text-xs">导入数据</span>
        </button>
      </RibbonGroup>
      <RibbonGroup label="导出">
        <button onClick={handleExportPNG} className="ribbon-btn" title="导出 PNG">
          <Download size={18} />
          <span className="text-[10px]">PNG</span>
        </button>
        <button onClick={handleExportPDF} className="ribbon-btn" title="导出 PDF">
          <Download size={18} />
          <span className="text-[10px]">PDF</span>
        </button>
        <button onClick={handleExportCSV} className="ribbon-btn" title="导出 CSV">
          <Download size={18} />
          <span className="text-[10px]">CSV</span>
        </button>
      </RibbonGroup>
      <RibbonGroup label="主题">
        <button onClick={toggleTheme} className="ribbon-btn" title={theme === 'dark' ? '切换浅色主题' : '切换深色主题'}>
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          <span className="text-[10px]">{theme === 'dark' ? '浅色' : '深色'}</span>
        </button>
      </RibbonGroup>
    </div>
  );
}

// ─── Data Tab ───────────────────────────────────────────────────
function GenerateTab() {
  const addDataset = usePlotStore((s) => s.addDataset);

  return (
    <div className="flex items-stretch">
      <RibbonGroup label="函数曲线">
        <button onClick={() => addDataset(createSampleSineDataset())} className="ribbon-btn">
          <Waves size={18} />
          <span className="text-xs">正弦</span>
        </button>
        <button onClick={() => addDataset(createSampleSurfaceDataset())} className="ribbon-btn">
          <Mountain size={18} />
          <span className="text-xs">Sinc 曲面</span>
        </button>
      </RibbonGroup>
      <RibbonGroup label="3D 形状">
        <button onClick={() => addDataset(createSampleScatter3DDataset())} className="ribbon-btn">
          <Circle size={18} />
          <span className="text-xs">球体</span>
        </button>
      </RibbonGroup>
      <RibbonGroup label="其他">
        <button onClick={() => addDataset(createSampleBarDataset())} className="ribbon-btn">
          <BarChart3 size={18} />
          <span className="text-xs">柱状</span>
        </button>
      </RibbonGroup>
    </div>
  );
}

function TransformTab() {
  const datasets = usePlotStore((s) => s.datasets);
  const activeDatasetId = usePlotStore((s) => s.activeDatasetId);
  const transformColumn = usePlotStore((s) => s.transformColumn);
  const addComputedColumn = usePlotStore((s) => s.addComputedColumn);
  const sortDataset = usePlotStore((s) => s.sortDataset);
  const normalizeColumn = usePlotStore((s) => s.normalizeColumn);
  const addColumn = usePlotStore((s) => s.addColumn);
  const addRow = usePlotStore((s) => s.addRow);

  const activeDs = datasets.find((d) => d.id === activeDatasetId);
  const yCol = activeDs?.columns.find((c) => c.type === 'Y') ?? activeDs?.columns[1];
  const xCol = activeDs?.columns.find((c) => c.type === 'X') ?? activeDs?.columns[0];

  const transform = (fn: (v: number) => number) => {
    if (!activeDs || !yCol) return;
    transformColumn(activeDs.id, yCol.id, fn);
  };

  const compute = (name: string, fn: (row: Record<string, number>) => number) => {
    if (!activeDs) return;
    addComputedColumn(activeDs.id, name, fn);
  };

  return (
    <div className="flex items-stretch">
      <RibbonGroup label="数学变换（对 Y 列）">
        <button onClick={() => transform(Math.log)} className="ribbon-btn" title="ln(y)">
          <span className="text-sm font-mono">ln</span>
          <span className="text-[10px]">对数</span>
        </button>
        <button onClick={() => transform(Math.log10)} className="ribbon-btn" title="log10(y)">
          <span className="text-sm font-mono">lg</span>
          <span className="text-[10px]">常用对数</span>
        </button>
        <button onClick={() => transform(Math.exp)} className="ribbon-btn" title="e^y">
          <span className="text-sm font-mono">eˣ</span>
          <span className="text-[10px]">指数</span>
        </button>
        <button onClick={() => transform(Math.sqrt)} className="ribbon-btn" title="√y">
          <span className="text-sm font-mono">√</span>
          <span className="text-[10px]">平方根</span>
        </button>
        <button onClick={() => transform((v) => v * v)} className="ribbon-btn" title="y²">
          <span className="text-sm font-mono">x²</span>
          <span className="text-[10px]">平方</span>
        </button>
        <button onClick={() => transform((v) => 1 / v)} className="ribbon-btn" title="1/y">
          <span className="text-sm font-mono">1/x</span>
          <span className="text-[10px]">倒数</span>
        </button>
        <button onClick={() => transform(Math.abs)} className="ribbon-btn" title="|y|">
          <span className="text-sm font-mono">|x|</span>
          <span className="text-[10px]">绝对值</span>
        </button>
      </RibbonGroup>

      <RibbonGroup label="三角函数（对 Y 列）">
        <button onClick={() => transform(Math.sin)} className="ribbon-btn" title="sin(y)">
          <span className="text-sm font-mono">sin</span>
        </button>
        <button onClick={() => transform(Math.cos)} className="ribbon-btn" title="cos(y)">
          <span className="text-sm font-mono">cos</span>
        </button>
        <button onClick={() => transform(Math.tan)} className="ribbon-btn" title="tan(y)">
          <span className="text-sm font-mono">tan</span>
        </button>
        <button onClick={() => transform((v) => v * Math.PI / 180)} className="ribbon-btn" title="y° → rad">
          <span className="text-sm font-mono">°→r</span>
          <span className="text-[10px]">度→弧度</span>
        </button>
      </RibbonGroup>

      <RibbonGroup label="计算列">
        <button onClick={() => compute('x+y', (r) => (r[activeDs!.columns[0].name] ?? 0) + (r[activeDs!.columns[1].name] ?? 0))} className="ribbon-btn" title="X + Y">
          <span className="text-sm font-mono">+</span>
          <span className="text-[10px]">加</span>
        </button>
        <button onClick={() => compute('x-y', (r) => (r[activeDs!.columns[0].name] ?? 0) - (r[activeDs!.columns[1].name] ?? 0))} className="ribbon-btn" title="X - Y">
          <span className="text-sm font-mono">−</span>
          <span className="text-[10px]">减</span>
        </button>
        <button onClick={() => compute('x*y', (r) => (r[activeDs!.columns[0].name] ?? 0) * (r[activeDs!.columns[1].name] ?? 0))} className="ribbon-btn" title="X × Y">
          <span className="text-sm font-mono">×</span>
          <span className="text-[10px]">乘</span>
        </button>
        <button onClick={() => compute('x/y', (r) => { const d = r[activeDs!.columns[1].name]; return d ? r[activeDs!.columns[0].name] / d : NaN; })} className="ribbon-btn" title="X ÷ Y">
          <span className="text-sm font-mono">÷</span>
          <span className="text-[10px]">除</span>
        </button>
      </RibbonGroup>

      <RibbonGroup label="数据操作">
        <button
          onClick={() => { if (activeDs && yCol) sortDataset(activeDs.id, yCol.id, true); }}
          className="ribbon-btn" title="按 Y 列升序排列"
        >
          <ArrowUpDown size={16} />
          <span className="text-[10px]">升序</span>
        </button>
        <button
          onClick={() => { if (activeDs && yCol) sortDataset(activeDs.id, yCol.id, false); }}
          className="ribbon-btn" title="按 Y 列降序排列"
        >
          <ArrowUpDown size={16} className="rotate-180" />
          <span className="text-[10px]">降序</span>
        </button>
        <button
          onClick={() => { if (activeDs && yCol) normalizeColumn(activeDs.id, yCol.id); }}
          className="ribbon-btn" title="归一化 Y 列到 [0,1]"
        >
          <Minimize2 size={16} />
          <span className="text-[10px]">归一化</span>
        </button>
        {activeDs && (
          <>
            <button onClick={() => addColumn(activeDs.id)} className="ribbon-btn" title="添加列">
              <Plus size={16} />
              <span className="text-[10px]">加列</span>
            </button>
            <button onClick={() => addRow(activeDs.id)} className="ribbon-btn" title="添加行">
              <Plus size={16} />
              <span className="text-[10px]">加行</span>
            </button>
          </>
        )}
      </RibbonGroup>
    </div>
  );
}

// ─── Chart Tab ──────────────────────────────────────────────────
function ChartTab() {
  const chartConfig = usePlotStore((s) => s.chartConfig);
  const setChartType = usePlotStore((s) => s.setChartType);
  const scene3D = usePlotStore((s) => s.scene3D);
  const setScene3D = usePlotStore((s) => s.setScene3D);
  const setChartTitle = usePlotStore((s) => s.setChartTitle);
  const is3D = ['surface3d', 'scatter3d', 'contour3d', 'bar3d'].includes(chartConfig.type);

  return (
    <div className="flex items-stretch">
      <RibbonGroup label="图表类型">
        {chartTypes.map(({ type, label, icon, group }) => (
          <button
            key={type}
            onClick={() => setChartType(type)}
            className={`ribbon-btn ${chartConfig.type === type ? 'bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/50' : ''} ${group === '3d' ? 'ml-1 border-l border-zinc-700 pl-2' : ''}`}
            title={label}
          >
            {icon}
            <span className="text-[10px]">{label}</span>
          </button>
        ))}
      </RibbonGroup>

      <RibbonGroup label="标题">
        <input
          type="text"
          value={chartConfig.title}
          onChange={(e) => setChartTitle(e.target.value)}
          className="w-40 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 outline-none focus:border-sky-500/50"
          placeholder="图表标题"
        />
      </RibbonGroup>

      {is3D && (
        <>
          <RibbonGroup label="光照">
            <div className="flex items-center gap-1">
              <Sun size={14} className="text-zinc-500" />
              <input
                type="range" min="0" max="1" step="0.05"
                value={scene3D.ambientIntensity}
                onChange={(e) => setScene3D({ ambientIntensity: Number(e.target.value) })}
                className="w-16 accent-sky-500"
              />
            </div>
          </RibbonGroup>
          <RibbonGroup label="透明度">
            <div className="flex items-center gap-1">
              <Droplets size={14} className="text-zinc-500" />
              <input
                type="range" min="0.1" max="1" step="0.05"
                value={scene3D.opacity}
                onChange={(e) => setScene3D({ opacity: Number(e.target.value) })}
                className="w-16 accent-sky-500"
              />
            </div>
          </RibbonGroup>
          <RibbonGroup label="颜色映射">
            <div className="flex items-center gap-1">
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
          </RibbonGroup>
          <RibbonGroup label="视角">
            <button onClick={() => setScene3D({ cameraPosition: [3, 3, 3] })} className="ribbon-btn" title="重置视角">
              <RotateCcw size={16} />
              <span className="text-[10px]">重置</span>
            </button>
            <button
              onClick={() => setScene3D({ showAxes: !scene3D.showAxes })}
              className={`ribbon-btn ${scene3D.showAxes ? 'text-sky-400' : ''}`}
              title="显示/隐藏坐标轴"
            >
              <Eye size={16} />
              <span className="text-[10px]">坐标轴</span>
            </button>
          </RibbonGroup>
        </>
      )}
    </div>
  );
}

// ─── Annotation Tab ─────────────────────────────────────────────
function AnnotationTab() {
  const annotations = usePlotStore((s) => s.chartConfig.annotations);
  const addAnnotation = usePlotStore((s) => s.addAnnotation);
  const removeAnnotation = usePlotStore((s) => s.removeAnnotation);
  const updateAnnotation = usePlotStore((s) => s.updateAnnotation);

  return (
    <div className="flex items-stretch">
      <RibbonGroup label="添加标注">
        {annotationTypes.map(({ type, label, icon }) => (
          <button
            key={type}
            onClick={() => addAnnotation(createDefaultAnnotation(type))}
            className="ribbon-btn"
          >
            {icon}
            <span className="text-xs">{label}</span>
          </button>
        ))}
      </RibbonGroup>

      {annotations.length > 0 && (
        <RibbonGroup label="标注列表">
          <div className="flex items-center gap-2 max-w-[600px] overflow-x-auto">
            {annotations.map((ann) => (
              <div key={ann.id} className="flex items-center gap-1 shrink-0 bg-zinc-800/50 rounded px-1.5 py-1">
                <button
                  onClick={() => updateAnnotation(ann.id, { visible: !ann.visible })}
                  className="text-zinc-400 hover:text-zinc-200"
                >
                  {ann.visible ? <Eye size={11} /> : <EyeOff size={11} />}
                </button>
                <span className="text-[10px] text-zinc-500 uppercase w-8">
                  {ann.type === 'latex' ? 'TeX' : ann.type}
                </span>
                {(ann.type === 'text' || ann.type === 'latex') && (
                  <input
                    type="text"
                    value={ann.content}
                    onChange={(e) => updateAnnotation(ann.id, { content: e.target.value })}
                    className="w-24 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-[10px] text-zinc-300 outline-none focus:border-sky-500/50"
                    placeholder={ann.type === 'latex' ? '$E=mc^2$' : '文本'}
                  />
                )}
                <input
                  type="color"
                  value={ann.color}
                  onChange={(e) => updateAnnotation(ann.id, { color: e.target.value })}
                  className="w-4 h-4 rounded cursor-pointer bg-transparent border-0"
                />
                <button
                  onClick={() => removeAnnotation(ann.id)}
                  className="text-zinc-600 hover:text-rose-400"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        </RibbonGroup>
      )}
    </div>
  );
}

// ─── Main Ribbon Component ──────────────────────────────────────
const tabs: { key: RibbonTab; label: string }[] = [
  { key: 'file', label: '文件' },
  { key: 'generate', label: '生成' },
  { key: 'transform', label: '变换' },
  { key: 'chart', label: '图' },
  { key: 'annotation', label: '标注' },
];

export default function Ribbon() {
  const [activeTab, setActiveTab] = useState<RibbonTab>('chart');

  return (
    <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }} className="select-none">
      {/* Tab headers */}
      <div className="flex items-end px-2 pt-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-1.5 text-xs font-medium rounded-t transition-colors ${
              activeTab === tab.key
                ? 'border-t border-x -mb-px'
                : 'hover:opacity-80'
            }`}
            style={activeTab === tab.key ? {
              background: 'var(--bg-input)',
              color: 'var(--accent)',
              borderColor: 'var(--border)',
              borderBottomColor: 'var(--bg-input)',
            } : {
              color: 'var(--text-muted)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-2 py-1 min-h-[56px] flex items-center" style={{ background: 'var(--bg-input)', borderTop: '1px solid var(--border)' }}>
        {activeTab === 'file' && <FileTab />}
        {activeTab === 'generate' && <GenerateTab />}
        {activeTab === 'transform' && <TransformTab />}
        {activeTab === 'chart' && <ChartTab />}
        {activeTab === 'annotation' && <AnnotationTab />}
      </div>
    </div>
  );
}
