import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

type Tone = 'ok' | 'err' | 'info';
interface ToastItem {
  id: number;
  tone: Tone;
  text: string;
}

const ToastCtx = createContext<((text: string, tone?: Tone) => void) | null>(null);
let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, tone: Tone = 'info') => {
    const id = ++counter;
    setItems((now) => [...now, { id, tone, text }]);
    window.setTimeout(() => setItems((now) => now.filter((t) => t.id !== id)), tone === 'err' ? 8000 : 4500);
  }, []);
  const value = useMemo(() => push, [push]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.tone === 'info' ? '' : t.tone}`}>
            <Icon name={t.tone === 'err' ? 'alert' : t.tone === 'ok' ? 'check' : 'info'} />
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): (text: string, tone?: Tone) => void {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
