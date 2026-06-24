import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDatasetStore, useChartStore } from '@/store/plotStore';
import { useToastStore } from '@/store/toastStore';
import { toNumber } from '@/types';
import { multiPeakFit, fmtPeak } from '@/utils/multiPeakFit';
import type { MultiPeakFitResult, PeakShape, BackgroundType } from '@/utils/peakTypes';
import { uid } from '@/utils/sampleData';
import { Activity, X, Plus, Trash2, Play, Download, Copy } from 'lucide-react';

interface MultiPeakFitModalProps {
  onClose: () => void;
}

export function MultiPeakFitModal({ onClose }: MultiPeakFitModalProps) {
  const { t } = useTranslation();
  const datasets = useDatasetStore((s) => s.datasets);
  const activeDatasetId = useDatasetStore((s) => s.activeDatasetId);
  const addDataset = useDatasetStore((s) => s.addDataset);
  const updateLayer = useChartStore((s) => s.updateLayer);
  const addToast = useToastStore((s) => s.addToast);

  const [shape, setShape] = useState<PeakShape>('gaussian');
  const [backgroundType, setBackgroundType] = useState<BackgroundType>('linear');
  const [backgroundDegree, setBackgroundDegree] = useState(2);
  const [autoDetect, setAutoDetect] = useState(true);
  const [manualPeaks, setManualPeaks] = useState<Array<{ center: number; amplitude: number; width: number }>>([]);
  const [result, setResult] = useState<MultiPeakFitResult | null>(null);
  const [isFitting, setIsFitting] = useState(false);

  const activeDs = datasets.find((d) => d.id === activeDatasetId);
  const xCol = activeDs?.columns.find((c) => c.type === 'X') ?? activeDs?.columns[0];
  const yCol = activeDs?.columns.find((c) => c.type === 'Y') ?? activeDs?.columns[1];

  const xyData = useMemo(() => {
    if (!xCol || !yCol) return { x: [] as number[], y: [] as number[] };
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < Math.min(xCol.values.length, yCol.values.length); i++) {
      const xv = toNumber(xCol.values[i]);
      const yv = toNumber(yCol.values[i]);
      if (Number.isFinite(xv) && Number.isFinite(yv)) {
        x.push(xv);
        y.push(yv);
      }
    }
    return { x, y };
  }, [xCol, yCol]);

  const runFit = useCallback(() => {
    if (xyData.x.length < 3) {
      addToast(t('toast.fitInsufficientData'), 'warning');
      return;
    }
    setIsFitting(true);
    // Defer to allow UI update
    setTimeout(() => {
      try {
        const initialPeaks = autoDetect ? undefined : manualPeaks.map((p) => ({
          amplitude: p.amplitude,
          center: p.center,
          width: p.width,
        }));
        const res = multiPeakFit(xyData.x, xyData.y, initialPeaks, {
          shape,
          backgroundType,
          backgroundDegree,
        });
        if (!res) {
          addToast(t('toast.fitInsufficientData'), 'warning');
        } else {
          setResult(res);
        }
      } catch {
        addToast(t('toast.fitInsufficientData'), 'warning');
      } finally {
        setIsFitting(false);
      }
    }, 10);
  }, [xyData, autoDetect, manualPeaks, shape, backgroundType, backgroundDegree, addToast, t]);

  const addManualPeak = useCallback(() => {
    const xMid = xyData.x.length > 0 ? xyData.x[Math.floor(xyData.x.length / 2)] : 0;
    const yMax = xyData.y.length > 0 ? Math.max(...xyData.y) : 1;
    const xRange = xyData.x.length > 1 ? Math.abs(xyData.x[xyData.x.length - 1] - xyData.x[0]) : 1;
    setManualPeaks((p) => [...p, { center: xMid, amplitude: yMax / 2, width: xRange / 20 }]);
  }, [xyData]);

  const removeManualPeak = useCallback((idx: number) => {
    setManualPeaks((p) => p.filter((_, i) => i !== idx));
  }, []);

  const addFitToChart = useCallback(() => {
    if (!result || !activeDs) return;

    const fitDatasetId = uid();
    const fitDataset = {
      id: fitDatasetId,
      name: `MultiPeak Fit (${shape})`,
      columns: [
        { id: uid(), name: 'x', type: 'X' as const, values: result.fittedX.map(String) },
        { id: uid(), name: 'y_fit', type: 'Y' as const, values: result.fittedY.map((v) => String(v)) },
      ],
    };
    addDataset(fitDataset);

    const autoLayer = useChartStore.getState().chartConfig.layers.find((l) => l.datasetId === fitDatasetId);
    if (autoLayer) {
      updateLayer(autoLayer.id, {
        color: '#ef4444',
        lineStyle: 'solid',
        lineWidth: 3,
        pointStyle: 'none',
        pointSize: 0,
        fill: false,
        displayName: `MultiPeak: ${result.peaks.length} peaks`,
      });
      addToast(t('toast.fitCurveAdded'), 'success');
    }
  }, [result, activeDs, shape, addDataset, updateLayer, addToast, t]);

  const copyResults = useCallback(async () => {
    if (!result) return;
    const lines: string[] = [];
    lines.push(`# Multi-Peak Fit Results (${shape})`);
    lines.push(`# R²=${result.rSquared.toFixed(6)}, Adj R²=${result.adjustedRSquared.toFixed(6)}, RMSE=${result.rmse.toFixed(6)}`);
    lines.push(`# Background: ${result.backgroundType}, coeffs=[${result.background.map((c) => c.toFixed(6)).join(', ')}]`);
    lines.push('');
    lines.push('Peak,Amplitude,Center,Width,FWHM,Area' + (shape === 'pseudovoigt' ? ',Eta' : ''));
    result.peaks.forEach((pk, i) => {
      const row = `${i + 1},${pk.amplitude.toFixed(6)},${pk.center.toFixed(6)},${pk.width.toFixed(6)},${pk.fwhm.toFixed(6)},${pk.area.toFixed(6)}`;
      lines.push(row + (shape === 'pseudovoigt' ? `,${(pk.eta ?? 0).toFixed(4)}` : ''));
    });
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      addToast(t('toast.copySuccess'), 'success');
    } catch {
      addToast(t('toast.copyFailed'), 'warning');
    }
  }, [result, shape, addToast, t]);

  const exportCSV = useCallback(() => {
    if (!result) return;
    const lines: string[] = [];
    lines.push('Peak,Amplitude,Center,Width,FWHM,Area' + (shape === 'pseudovoigt' ? ',Eta' : ''));
    result.peaks.forEach((pk, i) => {
      lines.push(
        `${i + 1},${pk.amplitude.toFixed(6)},${pk.center.toFixed(6)},${pk.width.toFixed(6)},${pk.fwhm.toFixed(6)},${pk.area.toFixed(6)}` +
        (shape === 'pseudovoigt' ? `,${(pk.eta ?? 0).toFixed(4)}` : '')
      );
    });
    lines.push('');
    lines.push(`R²,${result.rSquared.toFixed(6)}`);
    lines.push(`Adjusted R²,${result.adjustedRSquared.toFixed(6)}`);
    lines.push(`RMSE,${result.rmse.toFixed(6)}`);
    lines.push(`N,${result.n}`);
    lines.push(`Background,${result.backgroundType}`);
    lines.push(`Background Coeffs,"${result.background.map((c) => c.toFixed(6)).join(', ')}"`);

    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `multipeak_fit_${shape}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast(t('toast.exportSuccess'), 'success');
  }, [result, shape, addToast, t]);

  // SVG preview dimensions
  const svgW = 560;
  const svgH = 280;
  const margin = { top: 16, right: 16, bottom: 36, left: 50 };
  const plotW = svgW - margin.left - margin.right;
  const plotH = svgH - margin.top - margin.bottom;

  const xMin = xyData.x.length > 0 ? Math.min(...xyData.x) : 0;
  const xMax = xyData.x.length > 0 ? Math.max(...xyData.x) : 1;
  const yMin = xyData.y.length > 0 ? Math.min(...xyData.y, ...(result?.backgroundY ?? [])) : 0;
  const yMax = xyData.y.length > 0 ? Math.max(...xyData.y, ...(result?.fittedY ?? [])) : 1;
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;

  const toX = (v: number) => margin.left + ((v - xMin) / xRange) * plotW;
  const toY = (v: number) => margin.top + plotH - ((v - yMin) / yRange) * plotH;

  const dataPath = useMemo(() => {
    if (xyData.x.length === 0) return '';
    const tx = (v: number) => margin.left + ((v - xMin) / xRange) * plotW;
    const ty = (v: number) => margin.top + plotH - ((v - yMin) / yRange) * plotH;
    return xyData.x.map((x, i) => `${i === 0 ? 'M' : 'L'}${tx(x).toFixed(1)},${ty(xyData.y[i]).toFixed(1)}`).join(' ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xyData, xMin, xMax, yMin, yMax]);

  const fitPath = useMemo(() => {
    if (!result || result.fittedX.length === 0) return '';
    const tx = (v: number) => margin.left + ((v - xMin) / xRange) * plotW;
    const ty = (v: number) => margin.top + plotH - ((v - yMin) / yRange) * plotH;
    return result.fittedX.map((x, i) => `${i === 0 ? 'M' : 'L'}${tx(x).toFixed(1)},${ty(result.fittedY[i]).toFixed(1)}`).join(' ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, xMin, xMax, yMin, yMax]);

  const bgPath = useMemo(() => {
    if (!result || result.backgroundY.length === 0) return '';
    const tx = (v: number) => margin.left + ((v - xMin) / xRange) * plotW;
    const ty = (v: number) => margin.top + plotH - ((v - yMin) / yRange) * plotH;
    return result.fittedX.map((x, i) => `${i === 0 ? 'M' : 'L'}${tx(x).toFixed(1)},${ty(result.backgroundY[i]).toFixed(1)}`).join(' ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, xMin, xMax, yMin, yMax]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="rounded-lg shadow-xl flex flex-col"
        style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text-primary)', maxWidth: 900, maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <Activity size={16} />
            <span className="text-sm font-medium">{t('multipeak.title')}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-black/10" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-3 p-4 overflow-auto">
          {/* Options row */}
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex flex-col gap-1">
              <label style={{ color: 'var(--text-muted)' }}>{t('multipeak.shape')}</label>
              <select
                value={shape}
                onChange={(e) => setShape(e.target.value as PeakShape)}
                className="border rounded px-2 py-1"
                style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              >
                <option value="gaussian">{t('multipeak.gaussian')}</option>
                <option value="lorentzian">{t('multipeak.lorentzian')}</option>
                <option value="pseudovoigt">{t('multipeak.pseudovoigt')}</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label style={{ color: 'var(--text-muted)' }}>{t('multipeak.background')}</label>
              <select
                value={backgroundType}
                onChange={(e) => setBackgroundType(e.target.value as BackgroundType)}
                className="border rounded px-2 py-1"
                style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              >
                <option value="none">{t('multipeak.bgNone')}</option>
                <option value="linear">{t('multipeak.bgLinear')}</option>
                <option value="polynomial">{t('multipeak.bgPolynomial')}</option>
              </select>
            </div>

            {backgroundType === 'polynomial' && (
              <div className="flex flex-col gap-1">
                <label style={{ color: 'var(--text-muted)' }}>{t('multipeak.bgDegree')}</label>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={backgroundDegree}
                  onChange={(e) => setBackgroundDegree(Math.max(1, Math.min(6, parseInt(e.target.value) || 2)))}
                  className="border rounded px-2 py-1 w-16"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label style={{ color: 'var(--text-muted)' }}>{t('multipeak.detection')}</label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={autoDetect}
                  onChange={(e) => setAutoDetect(e.target.checked)}
                />
                <span>{t('multipeak.autoDetect')}</span>
              </label>
            </div>
          </div>

          {/* Manual peaks editor */}
          {!autoDetect && (
            <div className="flex flex-col gap-1 text-xs">
              <div className="flex items-center justify-between">
                <span style={{ color: 'var(--text-muted)' }}>{t('multipeak.manualPeaks')}</span>
                <button onClick={addManualPeak} className="ribbon-btn" title={t('multipeak.addPeak')}>
                  <Plus size={14} />
                  <span>{t('multipeak.addPeak')}</span>
                </button>
              </div>
              {manualPeaks.length > 0 && (
                <div className="flex flex-col gap-1 max-h-32 overflow-auto">
                  {manualPeaks.map((pk, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span style={{ color: 'var(--text-muted)' }}>#{i + 1}</span>
                      <label>
                        {t('multipeak.center')}
                        <input
                          type="number"
                          value={pk.center}
                          onChange={(e) => setManualPeaks((p) => p.map((x, j) => j === i ? { ...x, center: parseFloat(e.target.value) || 0 } : x))}
                          className="border rounded px-1 py-0.5 w-24 ml-1"
                          style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                        />
                      </label>
                      <label>
                        {t('multipeak.amp')}
                        <input
                          type="number"
                          value={pk.amplitude}
                          onChange={(e) => setManualPeaks((p) => p.map((x, j) => j === i ? { ...x, amplitude: parseFloat(e.target.value) || 0 } : x))}
                          className="border rounded px-1 py-0.5 w-20 ml-1"
                          style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                        />
                      </label>
                      <label>
                        {t('multipeak.width')}
                        <input
                          type="number"
                          value={pk.width}
                          onChange={(e) => setManualPeaks((p) => p.map((x, j) => j === i ? { ...x, width: parseFloat(e.target.value) || 0 } : x))}
                          className="border rounded px-1 py-0.5 w-20 ml-1"
                          style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                        />
                      </label>
                      <button onClick={() => removeManualPeak(i)} className="p-1 rounded hover:bg-black/10" title={t('multipeak.removePeak')}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Run button */}
          <div className="flex gap-2">
            <button
              onClick={runFit}
              disabled={isFitting || xyData.x.length < 3}
              className="ribbon-btn"
              style={{ background: 'rgba(14,165,233,0.2)', color: 'var(--accent)' }}
            >
              <Play size={14} />
              <span className="text-xs">{isFitting ? t('multipeak.fitting') : t('multipeak.run')}</span>
            </button>
          </div>

          {/* Preview plot */}
          <div className="rounded" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
            <svg width={svgW} height={svgH} style={{ display: 'block' }}>
              {/* Axes */}
              <line x1={margin.left} y1={margin.top + plotH} x2={margin.left + plotW} y2={margin.top + plotH} stroke="var(--text-muted, #6b7280)" strokeWidth={1} />
              <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + plotH} stroke="var(--text-muted, #6b7280)" strokeWidth={1} />

              {/* Data */}
              {dataPath && <path d={dataPath} fill="none" stroke="var(--text-secondary, #374151)" strokeWidth={1} opacity={0.6} />}

              {/* Background */}
              {bgPath && <path d={bgPath} fill="none" stroke="var(--text-muted, #9ca3af)" strokeWidth={1} strokeDasharray="3,3" />}

              {/* Fit */}
              {fitPath && <path d={fitPath} fill="none" stroke="var(--accent, #0ea5e9)" strokeWidth={2} />}

              {/* Peak markers */}
              {result?.peaks.map((pk, i) => (
                <g key={i}>
                  <line x1={toX(pk.center)} y1={toY(pk.amplitude)} x2={toX(pk.center)} y2={margin.top + plotH} stroke="var(--accent, #0ea5e9)" strokeWidth={0.5} strokeDasharray="2,2" opacity={0.5} />
                  <circle cx={toX(pk.center)} cy={toY(pk.amplitude)} r={3} fill="var(--accent, #0ea5e9)" />
                  <text x={toX(pk.center)} y={toY(pk.amplitude) - 6} textAnchor="middle" fontSize={9} fill="var(--text-muted, #6b7280)">{i + 1}</text>
                </g>
              ))}
            </svg>
          </div>

          {/* Results */}
          {result && (
            <div className="flex flex-col gap-2">
              {/* Summary */}
              <div className="flex gap-4 text-xs flex-wrap" style={{ color: 'var(--text-secondary)' }}>
                <span>{t('multipeak.peaks')}: <b>{result.peaks.length}</b></span>
                <span>R² = <b>{result.rSquared.toFixed(4)}</b></span>
                <span>{t('fit.adjustedR2')} = <b>{result.adjustedRSquared.toFixed(4)}</b></span>
                <span>RMSE = <b>{result.rmse.toFixed(4)}</b></span>
                <span>n = <b>{result.n}</b></span>
              </div>

              {/* Peak table */}
              <div className="overflow-auto max-h-48 rounded" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                <table className="border-collapse text-xs" style={{ color: 'var(--text-primary)' }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)' }}>
                      <th className="text-left px-2 py-1">#</th>
                      <th className="text-right px-2 py-1">{t('multipeak.amp')}</th>
                      <th className="text-right px-2 py-1">{t('multipeak.center')}</th>
                      <th className="text-right px-2 py-1">{t('multipeak.width')}</th>
                      <th className="text-right px-2 py-1">FWHM</th>
                      <th className="text-right px-2 py-1">{t('multipeak.area')}</th>
                      {shape === 'pseudovoigt' && <th className="text-right px-2 py-1">η</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {result.peaks.map((pk, i) => (
                      <tr key={i}>
                        <td className="px-2 py-0.5">{i + 1}</td>
                        <td className="text-right px-2 py-0.5 font-mono">{fmtPeak(pk.amplitude)}</td>
                        <td className="text-right px-2 py-0.5 font-mono">{fmtPeak(pk.center)}</td>
                        <td className="text-right px-2 py-0.5 font-mono">{fmtPeak(pk.width)}</td>
                        <td className="text-right px-2 py-0.5 font-mono">{fmtPeak(pk.fwhm)}</td>
                        <td className="text-right px-2 py-0.5 font-mono">{fmtPeak(pk.area)}</td>
                        {shape === 'pseudovoigt' && <td className="text-right px-2 py-0.5 font-mono">{fmtPeak(pk.eta ?? 0, 3)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button onClick={addFitToChart} className="ribbon-btn" title={t('fit.addCurve')}>
                  <Plus size={14} />
                  <span className="text-xs">{t('multipeak.addToChart')}</span>
                </button>
                <button onClick={copyResults} className="ribbon-btn" title={t('stats.copy')}>
                  <Copy size={14} />
                  <span className="text-xs">{t('stats.copy')}</span>
                </button>
                <button onClick={exportCSV} className="ribbon-btn" title={t('stats.exportCsv')}>
                  <Download size={14} />
                  <span className="text-xs">{t('stats.exportCsv')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
