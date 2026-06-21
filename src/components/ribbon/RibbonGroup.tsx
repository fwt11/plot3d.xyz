export function RibbonGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center border-r px-3 py-1.5 last:border-r-0" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-2 flex-1">{children}</div>
      <span className="text-xs mt-0.5 select-none" style={{ color: 'var(--text-faint)' }}>{label}</span>
    </div>
  );
}
