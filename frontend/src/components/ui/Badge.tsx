interface BadgeProps { children: React.ReactNode; variant?: 'neutral' | 'info' | 'success' | 'warn' | 'danger'; }

export function Badge({ children, variant = 'neutral' }: BadgeProps) {
  const styles: Record<string, { bg: string; color: string }> = {
    neutral: { bg: 'var(--border-subtle)', color: 'var(--text-muted)' },
    info:    { bg: 'var(--primary-bg)',    color: 'var(--primary-dim)' },
    success: { bg: 'var(--success-bg)',    color: 'var(--success-dim)' },
    warn:    { bg: 'var(--warning-bg)',    color: 'var(--warning-dim)' },
    danger:  { bg: 'var(--danger-bg)',     color: 'var(--danger)' },
  };
  const s = styles[variant] || styles.neutral;
  return (
    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, fontWeight: 600, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}
