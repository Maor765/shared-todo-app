export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: React.ReactNode; title?: string }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'flex-end', borderRadius: 28 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--bg-card)', borderRadius: '16px 16px 0 0', padding: '16px 16px 32px', width: '100%', maxHeight: '85%', overflowY: 'auto' }}
      >
        <div style={{ width: 36, height: 4, background: 'var(--border-light)', borderRadius: 2, margin: '0 auto 14px' }} />
        {title && <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>{title}</div>}
        {children}
      </div>
    </div>
  );
}
