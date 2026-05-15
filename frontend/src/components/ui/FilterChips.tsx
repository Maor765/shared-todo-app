export function FilterChips({ options, labels, value, onChange }: {
  options: string[];
  labels?: string[];
  value: string;
  onChange: (opt: string) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, padding: '8px 16px', overflowX: 'auto', borderBottom: '0.5px solid var(--border)' }}>
      {options.map((opt, i) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          style={{
            fontSize: 12, padding: '5px 12px', borderRadius: 999, border: '0.5px solid',
            fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all .15s',
            background: value === opt ? 'var(--primary)' : 'var(--bg)',
            color: value === opt ? '#fff' : 'var(--text-dim)',
            borderColor: value === opt ? 'var(--primary)' : 'var(--border)',
          }}
        >
          {labels ? labels[i] : opt}
        </button>
      ))}
    </div>
  );
}
