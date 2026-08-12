import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };
const STYLES = {
  success: 'border-signal-ok/30 bg-signal-okBg text-signal-ok',
  error: 'border-signal-danger/30 bg-signal-dangerBg text-signal-danger',
  info: 'border-signal-info/30 bg-signal-infoBg text-signal-info',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => dismiss(id), type === 'error' ? 6000 : 3500);
  }, [dismiss]);

  const toast = useMemo(() => ({
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error'),
    info: (m) => push(m, 'info'),
  }), [push]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
        {toasts.map((t) => {
          const Icon = ICONS[t.type];
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-2.5 border rounded-lg px-3.5 py-2.5 shadow-pop animate-slide-in ${STYLES[t.type]}`}
            >
              <Icon size={16} className="mt-0.5 shrink-0" />
              <p className="text-sm leading-snug flex-1">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast ko ToastProvider ke andar use karo');
  return ctx;
};
