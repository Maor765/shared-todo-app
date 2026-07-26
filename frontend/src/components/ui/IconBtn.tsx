interface IconBtnProps {
  icon: string;
  onClick: () => void;
  size?: { svg: number; btn: number };
}

export function IconBtn({ icon, onClick, size = { svg: 18, btn: 34 } }: IconBtnProps) {
  return (
    <button
      onClick={onClick}
      style={{
        width: size.btn, height: size.btn, borderRadius: '50%',
        background: 'var(--bg)', border: '0.5px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: 'var(--text-dim)', flexShrink: 0,
      }}
    >
      <svg width={size.svg} height={size.svg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={icon} />
      </svg>
    </button>
  );
}
