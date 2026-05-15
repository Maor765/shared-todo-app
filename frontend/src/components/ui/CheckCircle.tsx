export function CheckCircle({ done, onToggle }: { done: boolean; onToggle: () => void }) {
  return (
    <div
      onClick={onToggle}
      style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
        border: done ? 'none' : '1.5px solid var(--border-mid)',
        background: done ? 'var(--success)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all .15s', marginTop: 1,
      }}
    >
      {done && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}
