import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDatasetStore, useChartStore } from '@/store/plotStore';
import { useFitStore, type FitResult } from '@/store/fitStore';
import { useToastStore } from '@/store/toastStore';
import { uid } from '@/utils/sampleData';
import { fitResultToCSV, fitResultToText, equationToLatex, downloadTextFile, type FitExportData } from '@/utils/fitExport';
import {
  TrendingUp,
  BarChart3,
  ChevronDown,
  ChevronUp,
  X,
  Copy,
  Download,
  FileText,
} from 'lucide-react';

export function FitResultsBar() {
  const { t } = useTranslation();
  const fitResult = useFitStore((s) => s.fitResult);
  const showStats = useFitStore((s) => s.showStats);
  const showResidualPlot = useFitStore((s) => s.showResidualPlot);
  const residualMode = useFitStore((s) => s.residualMode);
  const setShowStats = useFitStore((s) => s.setShowStats);
  const setShowResidualPlot = useFitStore((s) => s.setShowResidualPlot);
  const setResidualMode = useFitStore((s) => s.setResidualMode);
  const clearFitResult = useFitStore((s) => s.clearFitResult);

  if (!fitResult) return null;

  return (
    <div
      className="px-4 py-2 text-xs shrink-0"
      style={{
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        color: 'var(--text-secondary)',
      }}
    >
      <div className="flex items-start gap-4">
        {/* Equation + metrics */}
        <div className="flex flex-col gap-0.5 min-w-0">
          <div
            className="font-mono text-xs truncate"
            title={fitResult.equation}
            style={{ color: 'var(--text-primary)' }}
          >
            {fitResult.equation}
          </div>
          <div className="flex gap-3 flex-wrap">
            <span>R² = {fitResult.rSquared.toFixed(4)}</span>
            <span title={t('fit.adjustedR2')}>
              {t('fit.adjustedR2')} = {fitResult.adjustedRSquared.toFixed(4)}
            </span>
            <span>RMSE = {fitResult.rmse.toFixed(4)}</span>
            <span title={t('fit.residualSE')}>
              {t('fit.residualSE')} = {fitResult.residualSE.toFixed(4)}
            </span>
            <span>n = {fitResult.n}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 ml-auto shrink-0">
          <FitActionButton
            active={showStats}
            onClick={() => setShowStats(!showStats)}
            icon={showStats ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            label={t('fit.parameters')}
            title={showStats ? t('fit.hideStats') : t('fit.showStats')}
          />
          <FitActionButton
            onClick={() => setShowResidualPlot(true)}
            icon={<BarChart3 size={14} />}
            label={t('fit.residualPlot')}
            title={t('fit.residualPlot')}
          />
          <FitActionButton
            onClick={() => addFitCurve(fitResult, t)}
            icon={<TrendingUp size={14} />}
            label={t('fit.addCurve')}
            title={t('fit.addCurve')}
          />
          <FitActionButton
            onClick={() => copyFitResult(fitResult, t)}
            icon={<Copy size={14} />}
            label={t('fit.copy')}
            title={t('fit.copyResult')}
          />
          <FitActionButton
            onClick={() => exportFitCSV(fitResult, t)}
            icon={<Download size={14} />}
            label="CSV"
            title={t('fit.exportCsv')}
          />
          <FitActionButton
            onClick={() => exportFitLatex(fitResult, t)}
            icon={<FileText size={14} />}
            label="LaTeX"
            title={t('fit.exportLatex')}
          />
          <div style={{ width: '1px', height: '16px', background: 'var(--border)' }} className="mx-1" />
          <button
            onClick={clearFitResult}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors hover:opacity-80"
            style={{ color: 'var(--text-muted)' }}
            title={t('fit.clearResult', { defaultValue: 'Clear fit results' })}
            aria-label={t('fit.clearResult', { defaultValue: 'Clear fit results' })}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {showStats && <FitParametersTable fitResult={fitResult} />}

      {showResidualPlot && (
        <ResidualPlotModal
          fitResult={fitResult}
          mode={residualMode}
          onModeChange={setResidualMode}
          onClose={() => setShowResidualPlot(false)}
          t={t}
        />
      )}
    </div>
  );
}

function FitActionButton({
  onClick,
  icon,
  label,
  title,
  active,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  title: string;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
        active ? 'ring-1 ring-sky-500/50' : ''
      }`}
      style={
        active
          ? { background: 'rgba(14,165,233,0.2)', color: 'var(--accent)' }
          : { color: 'var(--text-secondary)' }
      }
      title={title}
      aria-label={title}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function FitParametersTable({ fitResult }: { fitResult: FitResult }) {
  const { t } = useTranslation();
  return (
    <div
      className="mt-2 p-2 rounded text-xs overflow-x-auto inline-block"
      style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}
    >
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
              <td className="text-right pr-3 font-mono">
                {fitResult.stats.parameterEstimates[i].toFixed(4)}
              </td>
              <td className="text-right pr-3 font-mono">
                {Number.isFinite(fitResult.stats.parameterSE[i])
                  ? fitResult.stats.parameterSE[i].toFixed(4)
                  : '—'}
              </td>
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
  );
}

function addFitCurve(fitResult: FitResult, t: (key: string) => string) {
  const activeDs = useDatasetStore.getState().datasets.find(
    (d) => d.id === useDatasetStore.getState().activeDatasetId
  );
  const addToast = useToastStore.getState().addToast;
  const addDataset = useDatasetStore.getState().addDataset;
  const updateLayer = useChartStore.getState().updateLayer;

  if (!fitResult || !activeDs) {
    addToast(t('toast.fitInsufficientData'), 'warning');
    return;
  }

  const fitDatasetId = uid();
  addDataset({
    id: fitDatasetId,
    name: `Fit (${fitResult.type})`,
    columns: [
      { id: uid(), name: 'x', type: 'X', values: fitResult.fittedX.map(String) },
      { id: uid(), name: 'y_fit', type: 'Y', values: fitResult.fittedY.map((v) => String(v)) },
    ],
  });

  const autoLayer = useChartStore
    .getState()
    .chartConfig.layers.find((l) => l.datasetId === fitDatasetId);
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
}

function buildExportData(fitResult: FitResult): FitExportData {
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
}

async function copyFitResult(fitResult: FitResult, t: (key: string) => string) {
  const addToast = useToastStore.getState().addToast;
  try {
    await navigator.clipboard.writeText(fitResultToText(buildExportData(fitResult)));
    addToast(t('toast.copySuccess'), 'success');
  } catch {
    addToast(t('toast.copyFailed'), 'warning');
  }
}

function exportFitCSV(fitResult: FitResult, t: (key: string) => string) {
  const addToast = useToastStore.getState().addToast;
  const data = buildExportData(fitResult);
  downloadTextFile(fitResultToCSV(data), `fit_${data.type}.csv`, 'text/csv;charset=utf-8');
  addToast(t('toast.exportSuccess'), 'success');
}

function exportFitLatex(fitResult: FitResult, t: (key: string) => string) {
  const addToast = useToastStore.getState().addToast;
  const latex = equationToLatex(fitResult.equation);
  downloadTextFile(latex, `fit_${fitResult.type}.tex`, 'application/x-tex;charset=utf-8');
  addToast(t('toast.exportSuccess'), 'success');
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

  const xData = mode === 'fitted' ? stats.fittedValues : stats.xValues;
  const xLabel = mode === 'fitted' ? t('fit.residualVsFitted') : t('fit.residualVsX');
  const yData = stats.residuals;

  const xMin = Math.min(...xData);
  const xMax = Math.max(...xData);
  const yMin = Math.min(...yData, 0);
  const yMax = Math.max(...yData, 0);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;

  const width = 480;
  const height = 320;
  const margin = { top: 20, right: 20, bottom: 50, left: 60 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const toX = (v: number) => margin.left + ((v - xMin) / xRange) * plotWidth;
  const toY = (v: number) => margin.top + plotHeight - ((v - yMin) / yRange) * plotHeight;

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
      style={{ background: '#000000' }}
      onClick={onClose}
    >
      <div
        className="rounded-lg shadow-xl"
        style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 py-2 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <BarChart3 size={16} />
            <span className="text-sm font-medium">{t('fit.residualPlot')}</span>
            <div className="flex gap-1 ml-4">
              <button
                onClick={() => onModeChange('fitted')}
                className={`px-2 py-0.5 text-xs rounded ${
                  mode === 'fitted' ? 'ring-1 ring-sky-500/50' : ''
                }`}
                style={
                  mode === 'fitted'
                    ? { background: 'rgba(14,165,233,0.2)', color: 'var(--accent)' }
                    : { color: 'var(--text-muted)' }
                }
              >
                {t('fit.residualVsFitted')}
              </button>
              <button
                onClick={() => onModeChange('x')}
                className={`px-2 py-0.5 text-xs rounded ${
                  mode === 'x' ? 'ring-1 ring-sky-500/50' : ''
                }`}
                style={
                  mode === 'x'
                    ? { background: 'rgba(14,165,233,0.2)', color: 'var(--accent)' }
                    : { color: 'var(--text-muted)' }
                }
              >
                {t('fit.residualVsX')}
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-black/10"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4">
          <svg width={width} height={height} style={{ display: 'block' }}>
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

            <line
              x1={margin.left}
              y1={toY(0)}
              x2={margin.left + plotWidth}
              y2={toY(0)}
              stroke="var(--text-muted, #6b7280)"
              strokeWidth={1.5}
            />

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

            <line
              x1={margin.left}
              y1={margin.top + plotHeight}
              x2={margin.left + plotWidth}
              y2={margin.top + plotHeight}
              stroke="var(--text-muted, #6b7280)"
              strokeWidth={1}
            />
            <line
              x1={margin.left}
              y1={margin.top}
              x2={margin.left}
              y2={margin.top + plotHeight}
              stroke="var(--text-muted, #6b7280)"
              strokeWidth={1}
            />

            {xTicks.map((tick, i) => (
              <g key={`tick-x-${i}`}>
                <line
                  x1={toX(tick)}
                  y1={margin.top + plotHeight}
                  x2={toX(tick)}
                  y2={margin.top + plotHeight + 4}
                  stroke="var(--text-muted, #6b7280)"
                  strokeWidth={1}
                />
                <text
                  x={toX(tick)}
                  y={margin.top + plotHeight + 16}
                  textAnchor="middle"
                  fontSize={10}
                  fill="var(--text-muted, #6b7280)"
                >
                  {formatTick(tick)}
                </text>
              </g>
            ))}

            {yTicks.map((tick, i) => (
              <g key={`tick-y-${i}`}>
                <line
                  x1={margin.left - 4}
                  y1={toY(tick)}
                  x2={margin.left}
                  y2={toY(tick)}
                  stroke="var(--text-muted, #6b7280)"
                  strokeWidth={1}
                />
                <text
                  x={margin.left - 6}
                  y={toY(tick) + 3}
                  textAnchor="end"
                  fontSize={10}
                  fill="var(--text-muted, #6b7280)"
                >
                  {formatTick(tick)}
                </text>
              </g>
            ))}

            <text
              x={margin.left + plotWidth / 2}
              y={height - 8}
              textAnchor="middle"
              fontSize={11}
              fill="var(--text-secondary, #374151)"
            >
              {xLabel}
            </text>
            <text
              x={14}
              y={margin.top + plotHeight / 2}
              textAnchor="middle"
              fontSize={11}
              fill="var(--text-secondary, #374151)"
              transform={`rotate(-90, 14, ${margin.top + plotHeight / 2})`}
            >
              {t('fit.residualPlot')}
            </text>
          </svg>

          <div className="flex gap-4 mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>n = {stats.n}</span>
            <span>
              {t('fit.dof')} = {stats.n - stats.p}
            </span>
            <span>SSE = {stats.sse.toFixed(4)}</span>
            <span>RMSE = {stats.rmse.toFixed(4)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
