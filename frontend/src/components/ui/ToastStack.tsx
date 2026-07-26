import { useEffect, useState } from 'react';
import { subscribeToasts, ToastMessage } from '../../lib/toast';

export function ToastStack() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  useEffect(() => subscribeToasts(setMessages), []);

  if (messages.length === 0) return null;

  return (
    <div style={{ position: 'absolute', bottom: 70, left: 16, right: 16, zIndex: 30, display: 'flex', flexDirection: 'column', gap: 6, pointerEvents: 'none' }}>
      {messages.map((m) => (
        <div
          key={m.id}
          style={{
            background: 'var(--text)', color: 'var(--bg-card)', borderRadius: 10,
            padding: '10px 14px', fontSize: 15, fontWeight: 500, boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          }}
        >
          {m.text}
        </div>
      ))}
    </div>
  );
}
