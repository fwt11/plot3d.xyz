import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDatasetStore, useChartStore } from '@/store/plotStore';
import { linearFit, polynomialFit, exponentialFit, generateFittedValues, calculateErrorStats } from '@/utils/curveFitting';
import { toNumber } from '@/types';
import { uid } from '@/utils/sampleData';
import { RibbonGroup } from './RibbonGroup';
import { TrendingUp } from 'lucide-react';

type FitType = 'linear' | 'poly2' | 'poly3' | 'poly4' | 'poly5' | 'poly6' | 'exponential';

interface FitResult {
  type: FitType;
  rSquared: number;
  rmse: number;
  mae: number;
  equation: string;
  fittedX: number[];
  fittedY: number[];
}

export function FitTab() {
  const { t } = useTranslation();
  const datasets = useDatasetStore((s) => s.datasets);
  const activeDatasetId = useDatasetStore((s) => s.activeDatasetId);
  const addDataset = useDatasetStore((s) => s.addDataset);
  const addLayer = useChartStore((s) => s.addLayer);

  const [fitResult, setFitResult] = useState<FitResult | null>(null);

  const activeDs = datasets.find((d) => d.id === activeDatasetId);
  const xCol = activeDs?.columns.find((c) => c.type === 'X') ?? activeDs?.columns[0];
  const yCol = activeDs?.columns.find((c) => c.type === 'Y') ?? activeDs?.columns[1];

  const performFit = useCallback((fitType: FitType) => {
    if (!activeDs || !xCol || !yCol) return;

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

    if (validX.length < 3) return;

    const xMin = Math.min(...validX);
    const xMax = Math.max(...validX);

    let equation = '';
    let fittedFn: ((x: number) => number) | null = null;
    let rSquared = 0;

    if (fitType === 'linear') {
      const result = linearFit(validX, validY);
      if (!result) return;
      rSquared = result.rSquared;
      const sign = result.intercept >= 0 ? '+' : '-';
      equation = `y = ${result.slope.toFixed(4)}x ${sign} ${Math.abs(result.intercept).toFixed(4)}`;
      fittedFn = (x: number) => result.slope * x + result.intercept;
    } else if (fitType === 'exponential') {
      const result = exponentialFit(validX, validY);
      if (!result) return;
      rSquared = result.rSquared;
      equation = `y = ${result.a.toFixed(4)} * e^(${result.b.toFixed(4)}x)`;
      fittedFn = (x: number) => result.a * Math.exp(result.b * x);
    } else {
      const degree = parseInt(fitType.replace('poly', ''));
      const result = polynomialFit(validX, validY, degree);
      if (!result) return;
      rSquared = result.rSquared;
      const terms = result.coefficients.map((c, i) => {
        const exp = degree - i;
        if (exp === 0) return c.toFixed(4);
        if (exp === 1) return `${c.toFixed(4)}x`;
        return `${c.toFixed(4)}x^${exp}`;
      });
      equation = `y = ${terms.join(' + ').replace(/\+ -/g, '- ')}`;
      const coeffsLowToHigh = [...result.coefficients].reverse();
      fittedFn = (x: number) => {
        let y = 0;
        for (let j = 0; j < coeffsLowToHigh.length; j++) {
          y += coeffsLowToHigh[j] * Math.pow(x, j);
        }
        return y;
      };
    }

    const fitted = generateFittedValues(fittedFn, xMin, xMax, 100);
    const stats = calculateErrorStats(validY, validX.map(fittedFn));

    setFitResult({
      type: fitType,
      rSquared,
      rmse: stats?.rmse ?? 0,
      mae: stats?.meanAbsError ?? 0,
      equation,
      fittedX: fitted.x,
      fittedY: fitted.y,
    });
  }, [activeDs, xCol, yCol]);

  const addFitToChart = useCallback(() => {
    if (!fitResult || !activeDs) return;

    const fitDatasetId = uid();
    const fitLayerId = uid();

    const fitDataset = {
      id: fitDatasetId,
      name: `Fit (${fitResult.type})`,
      columns: [
        { id: uid(), name: 'x', type: 'X' as const, values: fitResult.fittedX.map(String) },
        { id: uid(), name: 'y_fit', type: 'Y' as const, values: fitResult.fittedY.map((v) => String(v)) },
      ],
    };

    addDataset(fitDataset);

    addLayer({
      id: fitLayerId,
      datasetId: fitDatasetId,
      xColumn: fitDataset.columns[0].id,
      yColumn: fitDataset.columns[1].id,
      color: '#ef4444',
      visible: true,
      lineStyle: 'dashed',
      lineWidth: 2,
      pointStyle: 'none',
      pointSize: 0,
      fill: false,
      displayName: `Fit: ${fitResult.type}`,
    });
  }, [fitResult, activeDs, addDataset, addLayer]);

  const fitButtons: { type: FitType; label: string }[] = [
    { type: 'linear', label: t('fit.linear') },
    { type: 'poly2', label: 'P2' },
    { type: 'poly3', label: 'P3' },
    { type: 'poly4', label: 'P4' },
    { type: 'poly5', label: 'P5' },
    { type: 'poly6', label: 'P6' },
    { type: 'exponential', label: t('fit.exponential') },
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
            disabled={!xCol || !yCol}
          >
            <span className="text-sm font-mono">{label}</span>
          </button>
        ))}
      </RibbonGroup>

      {fitResult && (
        <RibbonGroup label={t('fit.results')}>
          <div className="flex flex-col gap-0.5 text-xs min-w-0 max-w-xs" style={{ color: 'var(--text-secondary)' }}>
            <div className="font-mono text-xs truncate" title={fitResult.equation} style={{ color: 'var(--text-primary)' }}>
              {fitResult.equation}
            </div>
            <div className="flex gap-3">
              <span>R² = {fitResult.rSquared.toFixed(4)}</span>
              <span>RMSE = {fitResult.rmse.toFixed(4)}</span>
              <span>MAE = {fitResult.mae.toFixed(4)}</span>
            </div>
            <button
              onClick={addFitToChart}
              className="ribbon-btn mt-1 self-start"
              title={t('fit.addCurve')}
              aria-label={t('fit.addCurve')}
            >
              <TrendingUp size={14} />
              <span className="text-xs">{t('fit.addCurve')}</span>
            </button>
          </div>
        </RibbonGroup>
      )}
    </div>
  );
}
