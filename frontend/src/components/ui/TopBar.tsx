export function TopBar({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div style={{ padding: '16px 16px 8px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', letterSpacing: -0.5 }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>{right}</div>
    </div>
  );
}
