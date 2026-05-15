export function ProgressBar({ value, color = '#178AE8' }: { value: number; color?: string }) {
  return (
    <div style={{ height: 3, background: '#f0ede8', borderRadius: 2, marginTop: 8 }}>
      <div
        style={{
          height: '100%',
          width: `${Math.round(value)}%`,
          background: color,
          borderRadius: 2,
          transition: 'width .3s',
        }}
      />
    </div>
  );
}
