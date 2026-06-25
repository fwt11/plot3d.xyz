import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDatasetStore } from '@/store/plotStore';
import { useFitStore, type FitType, type FitResult } from '@/store/fitStore';
import { useToastStore } from '@/store/toastStore';
import { runFit } from '@/utils/fitWorkerClient';
import { toNumber } from '@/types';
import { RibbonGroup } from './RibbonGroup';
import { Activity } from 'lucide-react';
import { MultiPeakFitModal } from '@/components/MultiPeakFitModal';

export function FitTab() {
  const { t } = useTranslation();
  const datasets = useDatasetStore((s) => s.datasets);
  const activeDatasetId = useDatasetStore((s) => s.activeDatasetId);
  const addToast = useToastStore((s) => s.addToast);
  const setFitResult = useFitStore((s) => s.setFitResult);
  const setShowStats = useFitStore((s) => s.setShowStats);
  const showMultiPeak = useFitStore((s) => s.showMultiPeak);
  const setShowMultiPeak = useFitStore((s) => s.setShowMultiPeak);
  const isFitting = useFitStore((s) => s.isFitting);
  const setIsFitting = useFitStore((s) => s.setIsFitting);
  const activeFitType = useFitStore((s) => s.fitResult?.type);

  const activeDs = datasets.find((d) => d.id === activeDatasetId);
  const xCol = activeDs?.columns.find((c) => c.type === 'X') ?? activeDs?.columns[0];
  const yCol = activeDs?.columns.find((c) => c.type === 'Y') ?? activeDs?.columns[1];

  const performFit = useCallback(
    async (fitType: FitType) => {
      if (!activeDs || !xCol || !yCol) return;
      if (isFitting) return;

      const xValues = xCol.values.map(toNumber);
      const yValues = yCol.values.map(toNumber);

      const validX: number[] = [];
      const validY: number[] = [];
      for (let i = 0; i < Math.min(xValues.length, yValues.length); i++) {
        if (Number.isFinite(xValues[i]) && Number.isFinite(yValues[i])) {
          validX.push(xValues[i]);
          validY.push(yValues[i]);
        }
      }

      const minPointsMap: Partial<Record<FitType, number>> = {
        linear: 2,
        exponential: 2,
        logarithmic: 2,
        power: 2,
        gaussian: 3,
        logistic: 3,
      };
      const minPoints =
        minPointsMap[fitType] ??
        (fitType.startsWith('poly') ? parseInt(fitType.replace('poly', '')) + 1 : 2);
      if (validX.length < minPoints) {
        addToast(t('toast.fitInsufficientData'), 'warning');
        return;
      }

      setIsFitting(true);
      try {
        const result = await runFit(fitType, validX, validY);
        const fitResult: FitResult = {
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
        };
        setFitResult(fitResult);
        setShowStats(false);
      } catch {
        addToast(t('toast.fitInsufficientData'), 'warning');
      } finally {
        setIsFitting(false);
      }
    },
    [activeDs, xCol, yCol, addToast, t, isFitting, setFitResult, setShowStats, setIsFitting]
  );

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
    <>
      <div className="flex items-stretch">
        <RibbonGroup label={t('fit.curveFitting')}>
          {fitButtons.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => performFit(type)}
              className={`ribbon-btn ${activeFitType === type ? 'ring-1 ring-sky-500/50' : ''}`}
              style={
                activeFitType === type
                  ? { background: 'rgba(14,165,233,0.2)', color: 'var(--accent)' }
                  : {}
              }
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
      </div>

      {showMultiPeak && <MultiPeakFitModal onClose={() => setShowMultiPeak(false)} />}
    </>
  );
}
