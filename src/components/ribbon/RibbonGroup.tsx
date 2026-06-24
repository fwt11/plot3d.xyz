export function RibbonGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center border-r px-2 py-1 last:border-r-0" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-1 flex-1 flex-wrap">{children}</div>
      <span className="text-[11px] leading-4 mt-0.5 select-none" style={{ color: 'var(--text-faint)' }}>{label}</span>
    </div>
  );
}
