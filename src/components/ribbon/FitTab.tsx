import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDatasetStore, useChartStore } from '@/store/plotStore';
import { useToastStore } from '@/store/toastStore';
import { runFit } from '@/utils/fitWorkerClient';
import type { FitStatistics } from '@/utils/curveFitting';
import { toNumber } from '@/types';
import { uid } from '@/utils/sampleData';
import { RibbonGroup } from './RibbonGroup';
import { TrendingUp, BarChart3, ChevronDown, ChevronUp, X, Activity, Copy, Download, FileText } from 'lucide-react';
import { MultiPeakFitModal } from '@/components/MultiPeakFitModal';
import { fitResultToCSV, fitResultToText, equationToLatex, downloadTextFile, type FitExportData } from '@/utils/fitExport';

type FitType = 'linear' | 'poly2' | 'poly3' | 'poly4' | 'poly5' | 'poly6' | 'exponential' | 'logarithmic' | 'power' | 'gaussian' | 'logistic';

interface FitResult {
  type: FitType;
  rSquared: number;
  adjustedRSquared: number;
  rmse: number;
  mae: number;
  residualSE: number;
  n: number;
  dof: number;
  equation: string;
  fittedX: number[];
  fittedY: number[];
  stats: FitStatistics;
}

export function FitTab() {
  const { t } = useTranslation();
  const datasets = useDatasetStore((s) => s.datasets);
  const activeDatasetId = useDatasetStore((s) => s.activeDatasetId);
  const addDataset = useDatasetStore((s) => s.addDataset);
  const updateLayer = useChartStore((s) => s.updateLayer);
  const addToast = useToastStore((s) => s.addToast);

  const [fitResult, setFitResult] = useState<FitResult | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showResidualPlot, setShowResidualPlot] = useState(false);
  const [residualMode, setResidualMode] = useState<'fitted' | 'x'>('fitted');
  const [isFitting, setIsFitting] = useState(false);
  const [showMultiPeak, setShowMultiPeak] = useState(false);

  const activeDs = datasets.find((d) => d.id === activeDatasetId);
  const xCol = activeDs?.columns.find((c) => c.type === 'X') ?? activeDs?.columns[0];
  const yCol = activeDs?.columns.find((c) => c.type === 'Y') ?? activeDs?.columns[1];

  const performFit = useCallback(async (fitType: FitType) => {
    if (!activeDs || !xCol || !yCol) return;
    if (isFitting) return;

    const xValues = xCol.values.map(toNumber);
    const yValues = yCol.values.map(toNumber);

    // Filter valid pairs
    const validX: number[] = [];
    const validY: number[] = [];
    for (let i = 0; i < Math.min(xValues.length, yValues.length); i++) {
      if (Number.isFinite(xValues[i]) && Number.isFinite(yValues[i])) {
        validX.push(xValues[i]);
        validY.push(yValues[i]);
      }
    }

    const minPointsMap: Partial<Record<FitType, number>> = {
      linear: 2, exponential: 2, logarithmic: 2, power: 2,
      gaussian: 3, logistic: 3,
    };
    const minPoints = minPointsMap[fitType] ?? (fitType.startsWith('poly') ? parseInt(fitType.replace('poly', '')) + 1 : 2);
    if (validX.length < minPoints) {
      addToast(t('toast.fitInsufficientData'), 'warning');
      return;
    }

    setIsFitting(true);
    try {
      const result = await runFit(fitType, validX, validY);
      setFitResult({
        type: fitType,
        rSquared: result.stats.rSquared,
        adjustedRSquared: result.stats.adjustedRSquared,
        rmse: result.stats.rmse,
        mae: result.stats.mae,
        residualSE: result.stats.residualStandardError,
        n: result.stats.n,
        dof: result.stats.n - result.stats.p,
        equation: result.equation,
        fittedX: result.fittedX,
        fittedY: result.fittedY,
        stats: result.stats,
      });
      setShowStats(true);
    } catch {
      addToast(t('toast.fitInsufficientData'), 'warning');
    } finally {
      setIsFitting(false);
    }
  }, [activeDs, xCol, yCol, addToast, t, isFitting]);

  const addFitToChart = useCallback(() => {
    if (!fitResult || !activeDs) {
      addToast(t('toast.fitInsufficientData'), 'warning');
      return;
    }

    const fitDatasetId = uid();

    const fitDataset = {
      id: fitDatasetId,
      name: `Fit (${fitResult.type})`,
      columns: [
        { id: uid(), name: 'x', type: 'X' as const, values: fitResult.fittedX.map(String) },
        { id: uid(), name: 'y_fit', type: 'Y' as const, values: fitResult.fittedY.map((v) => String(v)) },
      ],
    };

    addDataset(fitDataset);

    // addDataset auto-creates a layer for the new dataset; update it instead of adding a duplicate
    const autoLayer = useChartStore.getState().chartConfig.layers.find((l) => l.datasetId === fitDatasetId);
    if (autoLayer) {
      updateLayer(autoLayer.id, {
        color: '#ef4444',
        lineStyle: 'dashed',
        lineWidth: 3,
        pointStyle: 'none',
        pointSize: 0,
        fill: false,
        displayName: `Fit: ${fitResult.type}`,
      });
      addToast(t('toast.fitCurveAdded'), 'success');
    }
  }, [fitResult, activeDs, addDataset, updateLayer, addToast, t]);

  const buildExportData = useCallback((): FitExportData | null => {
    if (!fitResult) return null;
    return {
      type: fitResult.type,
      equation: fitResult.equation,
      rSquared: fitResult.rSquared,
      adjustedRSquared: fitResult.adjustedRSquared,
      rmse: fitResult.rmse,
      mae: fitResult.mae,
      residualSE: fitResult.residualSE,
      n: fitResult.n,
      dof: fitResult.dof,
      stats: fitResult.stats,
    };
  }, [fitResult]);

  const copyFitResult = useCallback(async () => {
    const data = buildExportData();
    if (!data) return;
    try {
      await navigator.clipboard.writeText(fitResultToText(data));
      addToast(t('toast.copySuccess'), 'success');
    } catch {
      addToast(t('toast.copyFailed'), 'warning');
    }
  }, [buildExportData, addToast, t]);

  const exportFitCSV = useCallback(() => {
    const data = buildExportData();
    if (!data) return;
    downloadTextFile(fitResultToCSV(data), `fit_${data.type}.csv`, 'text/csv;charset=utf-8');
    addToast(t('toast.exportSuccess'), 'success');
  }, [buildExportData, addToast, t]);

  const exportFitLatex = useCallback(() => {
    if (!fitResult) return;
    const latex = equationToLatex(fitResult.equation);
    downloadTextFile(latex, `fit_${fitResult.type}.tex`, 'application/x-tex;charset=utf-8');
    addToast(t('toast.exportSuccess'), 'success');
  }, [fitResult, addToast, t]);

  const fitButtons: { type: FitType; label: string }[] = [
    { type: 'linear', label: t('fit.linear') },
    { type: 'poly2', label: 'P2' },
    { type: 'poly3', label: 'P3' },
    { type: 'poly4', label: 'P4' },
    { type: 'poly5', label: 'P5' },
    { type: 'poly6', label: 'P6' },
    { type: 'exponential', label: t('fit.exponential') },
    { type: 'logarithmic', label: t('fit.logarithmic') },
    { type: 'power', label: t('fit.power') },
    { type: 'gaussian', label: t('fit.gaussian') },
    { type: 'logistic', label: t('fit.logistic') },
  ];

  return (
    <div className="flex items-stretch">
      <RibbonGroup label={t('fit.curveFitting')}>
        {fitButtons.map(({ type, label }) => (
          <button
            key={type}
            onClick={() => performFit(type)}
            className={`ribbon-btn ${fitResult?.type === type ? 'ring-1 ring-sky-500/50' : ''}`}
            style={fitResult?.type === type ? { background: 'rgba(14,165,233,0.2)', color: 'var(--accent)' } : {}}
            title={label}
            aria-label={label}
            disabled={!xCol || !yCol || isFitting}
          >
            <span className="text-sm font-mono">{isFitting ? '…' : label}</span>
          </button>
        ))}
        <button
          onClick={() => setShowMultiPeak(true)}
          className="ribbon-btn ml-1 border-l pl-2"
          title={t('multipeak.title')}
          aria-label={t('multipeak.title')}
          disabled={!xCol || !yCol}
          style={{ borderColor: 'var(--border)' }}
        >
          <Activity size={16} />
          <span className="text-xs">{t('multipeak.button')}</span>
        </button>
      </RibbonGroup>

      {fitResult && (
        <RibbonGroup label={t('fit.results')}>
          <div className="flex flex-col gap-0.5 text-xs min-w-0 max-w-md" style={{ color: 'var(--text-secondary)' }}>
            <div className="font-mono text-xs truncate" title={fitResult.equation} style={{ color: 'var(--text-primary)' }}>
              {fitResult.equation}
            </div>
            <div className="flex gap-3 flex-wrap">
              <span>R² = {fitResult.rSquared.toFixed(4)}</span>
              <span title={t('fit.adjustedR2')}>{t('fit.adjustedR2')} = {fitResult.adjustedRSquared.toFixed(4)}</span>
              <span>RMSE = {fitResult.rmse.toFixed(4)}</span>
              <span title={t('fit.residualSE')}>{t('fit.residualSE')} = {fitResult.residualSE.toFixed(4)}</span>
              <span>n = {fitResult.n}</span>
            </div>
            <div className="flex gap-1 mt-1">
              <button
                onClick={() => setShowStats((v) => !v)}
                className="ribbon-btn"
                title={showStats ? t('fit.hideStats') : t('fit.showStats')}
                aria-label={showStats ? t('fit.hideStats') : t('fit.showStats')}
              >
                {showStats ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <span className="text-xs">{t('fit.parameters')}</span>
              </button>
              <button
                onClick={() => setShowResidualPlot(true)}
                className="ribbon-btn"
                title={t('fit.residualPlot')}
                aria-label={t('fit.residualPlot')}
              >
                <BarChart3 size={14} />
                <span className="text-xs">{t('fit.residualPlot')}</span>
              </button>
              <button
                onClick={addFitToChart}
                className="ribbon-btn"
                title={t('fit.addCurve')}
                aria-label={t('fit.addCurve')}
              >
                <TrendingUp size={14} />
                <span className="text-xs">{t('fit.addCurve')}</span>
              </button>
              <button
                onClick={copyFitResult}
                className="ribbon-btn"
                title={t('fit.copyResult')}
                aria-label={t('fit.copyResult')}
              >
                <Copy size={14} />
                <span className="text-xs">{t('fit.copy')}</span>
              </button>
              <button
                onClick={exportFitCSV}
                className="ribbon-btn"
                title={t('fit.exportCsv')}
                aria-label={t('fit.exportCsv')}
              >
                <Download size={14} />
                <span className="text-xs">CSV</span>
              </button>
              <button
                onClick={exportFitLatex}
                className="ribbon-btn"
                title={t('fit.exportLatex')}
                aria-label={t('fit.exportLatex')}
              >
                <FileText size={14} />
                <span className="text-xs">LaTeX</span>
              </button>
            </div>
            {showStats && (
              <div className="mt-1 p-2 rounded text-xs overflow-x-auto" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                <table className="border-collapse" style={{ color: 'var(--text-primary)' }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)' }}>
                      <th className="text-left pr-3 pb-1">{t('fit.parameters')}</th>
                      <th className="text-right pr-3 pb-1">{t('fit.estimate')}</th>
                      <th className="text-right pr-3 pb-1">{t('fit.stdError')}</th>
                      <th className="text-right pr-3 pb-1">{t('fit.ci95')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fitResult.stats.parameterNames.map((name, i) => (
                      <tr key={name}>
                        <td className="pr-3 font-mono">{name}</td>
                        <td className="text-right pr-3 font-mono">{fitResult.stats.parameterEstimates[i].toFixed(4)}</td>
                        <td className="text-right pr-3 font-mono">{Number.isFinite(fitResult.stats.parameterSE[i]) ? fitResult.stats.parameterSE[i].toFixed(4) : '—'}</td>
                        <td className="text-right pr-3 font-mono">
                          {Number.isFinite(fitResult.stats.parameterSE[i])
                            ? `[${fitResult.stats.parameterCI[i][0].toFixed(4)}, ${fitResult.stats.parameterCI[i][1].toFixed(4)}]`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-1" style={{ color: 'var(--text-muted)' }}>
                  {t('fit.dof')} = {fitResult.dof} · SSE = {fitResult.stats.sse.toFixed(4)}
                </div>
              </div>
            )}
          </div>
        </RibbonGroup>
      )}

      {showResidualPlot && fitResult && (
        <ResidualPlotModal
          fitResult={fitResult}
          mode={residualMode}
          onModeChange={setResidualMode}
          onClose={() => setShowResidualPlot(false)}
          t={t}
        />
      )}

      {showMultiPeak && (
        <MultiPeakFitModal onClose={() => setShowMultiPeak(false)} />
      )}
    </div>
  );
}

// --- Residual Plot Modal ---

interface ResidualPlotModalProps {
  fitResult: FitResult;
  mode: 'fitted' | 'x';
  onModeChange: (mode: 'fitted' | 'x') => void;
  onClose: () => void;
  t: (key: string) => string;
}

function ResidualPlotModal({ fitResult, mode, onModeChange, onClose, t }: ResidualPlotModalProps) {
  const { stats } = fitResult;

  // X-axis values: either fitted values or original x values
  const xData = mode === 'fitted' ? stats.fittedValues : stats.xValues;
  const xLabel = mode === 'fitted' ? t('fit.residualVsFitted') : t('fit.residualVsX');
  const yData = stats.residuals;

  // Compute axis ranges
  const xMin = Math.min(...xData);
  const xMax = Math.max(...xData);
  const yMin = Math.min(...yData, 0);
  const yMax = Math.max(...yData, 0);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;

  // SVG dimensions
  const width = 480;
  const height = 320;
  const margin = { top: 20, right: 20, bottom: 50, left: 60 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const toX = (v: number) => margin.left + ((v - xMin) / xRange) * plotWidth;
  const toY = (v: number) => margin.top + plotHeight - ((v - yMin) / yRange) * plotHeight;

  // Tick generation
  const xTicks = useMemo(() => {
    const nTicks = 5;
    const ticks: number[] = [];
    for (let i = 0; i <= nTicks; i++) {
      ticks.push(xMin + (xRange * i) / nTicks);
    }
    return ticks;
  }, [xMin, xRange]);

  const yTicks = useMemo(() => {
    const nTicks = 5;
    const ticks: number[] = [];
    for (let i = 0; i <= nTicks; i++) {
      ticks.push(yMin + (yRange * i) / nTicks);
    }
    return ticks;
  }, [yMin, yRange]);

  const formatTick = (v: number) => {
    if (Math.abs(v) < 0.001 || Math.abs(v) >= 100000) return v.toExponential(2);
    if (Math.abs(v) < 1) return v.toFixed(4);
    if (Math.abs(v) < 100) return v.toFixed(2);
    return v.toFixed(0);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="rounded-lg shadow-xl"
        style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <BarChart3 size={16} />
            <span className="text-sm font-medium">{t('fit.residualPlot')}</span>
            <div className="flex gap-1 ml-4">
              <button
                onClick={() => onModeChange('fitted')}
                className={`px-2 py-0.5 text-xs rounded ${mode === 'fitted' ? 'ring-1 ring-sky-500/50' : ''}`}
                style={mode === 'fitted' ? { background: 'rgba(14,165,233,0.2)', color: 'var(--accent)' } : { color: 'var(--text-muted)' }}
              >
                {t('fit.residualVsFitted')}
              </button>
              <button
                onClick={() => onModeChange('x')}
                className={`px-2 py-0.5 text-xs rounded ${mode === 'x' ? 'ring-1 ring-sky-500/50' : ''}`}
                style={mode === 'x' ? { background: 'rgba(14,165,233,0.2)', color: 'var(--accent)' } : { color: 'var(--text-muted)' }}
              >
                {t('fit.residualVsX')}
              </button>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-black/10" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Plot */}
        <div className="p-4">
          <svg width={width} height={height} style={{ display: 'block' }}>
            {/* Grid lines */}
            {yTicks.map((tick, i) => (
              <line
                key={`grid-y-${i}`}
                x1={margin.left}
                y1={toY(tick)}
                x2={margin.left + plotWidth}
                y2={toY(tick)}
                stroke="var(--grid-color, #e5e7eb)"
                strokeWidth={1}
                strokeDasharray={tick === 0 ? '' : '2,2'}
              />
            ))}

            {/* Zero line */}
            <line
              x1={margin.left}
              y1={toY(0)}
              x2={margin.left + plotWidth}
              y2={toY(0)}
              stroke="var(--text-muted, #6b7280)"
              strokeWidth={1.5}
            />

            {/* Scatter points */}
            {xData.map((xv, i) => (
              <circle
                key={`pt-${i}`}
                cx={toX(xv)}
                cy={toY(yData[i])}
                r={3}
                fill="var(--accent, #0ea5e9)"
                fillOpacity={0.6}
                stroke="var(--accent, #0ea5e9)"
                strokeWidth={0.5}
              />
            ))}

            {/* X-axis */}
            <line x1={margin.left} y1={margin.top + plotHeight} x2={margin.left + plotWidth} y2={margin.top + plotHeight} stroke="var(--text-muted, #6b7280)" strokeWidth={1} />
            {/* Y-axis */}
            <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + plotHeight} stroke="var(--text-muted, #6b7280)" strokeWidth={1} />

            {/* X-axis ticks and labels */}
            {xTicks.map((tick, i) => (
              <g key={`tick-x-${i}`}>
                <line x1={toX(tick)} y1={margin.top + plotHeight} x2={toX(tick)} y2={margin.top + plotHeight + 4} stroke="var(--text-muted, #6b7280)" strokeWidth={1} />
                <text x={toX(tick)} y={margin.top + plotHeight + 16} textAnchor="middle" fontSize={10} fill="var(--text-muted, #6b7280)">
                  {formatTick(tick)}
                </text>
              </g>
            ))}

            {/* Y-axis ticks and labels */}
            {yTicks.map((tick, i) => (
              <g key={`tick-y-${i}`}>
                <line x1={margin.left - 4} y1={toY(tick)} x2={margin.left} y2={toY(tick)} stroke="var(--text-muted, #6b7280)" strokeWidth={1} />
                <text x={margin.left - 6} y={toY(tick) + 3} textAnchor="end" fontSize={10} fill="var(--text-muted, #6b7280)">
                  {formatTick(tick)}
                </text>
              </g>
            ))}

            {/* Axis labels */}
            <text x={margin.left + plotWidth / 2} y={height - 8} textAnchor="middle" fontSize={11} fill="var(--text-secondary, #374151)">
              {xLabel}
            </text>
            <text x={14} y={margin.top + plotHeight / 2} textAnchor="middle" fontSize={11} fill="var(--text-secondary, #374151)" transform={`rotate(-90, 14, ${margin.top + plotHeight / 2})`}>
              {t('fit.residualPlot')}
            </text>
          </svg>

          {/* Summary stats */}
          <div className="flex gap-4 mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>n = {stats.n}</span>
            <span>{t('fit.dof')} = {stats.n - stats.p}</span>
            <span>SSE = {stats.sse.toFixed(4)}</span>
            <span>RMSE = {stats.rmse.toFixed(4)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
