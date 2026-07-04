import { useChartStore } from '@/store/plotStore';
import SubplotView from '@/components/SubplotView';

export default function ChartView() {
  const rows = useChartStore((s) => s.figure.rows);
  const cols = useChartStore((s) => s.figure.cols);
  const gap = useChartStore((s) => s.figure.gap);
  const count = useChartStore((s) => s.figure.subplots.length);

  if (count === 1) {
    // Fast path: identical to today, no grid wrapper overhead.
    return <SubplotView subplotIndex={0} />;
  }

  return (
    <div
      className="w-full h-full"
      style={{
        display: 'grid',
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: `${gap}px`,
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="relative min-w-0 min-h-0">
          <SubplotView subplotIndex={i} />
        </div>
      ))}
    </div>
  );
}