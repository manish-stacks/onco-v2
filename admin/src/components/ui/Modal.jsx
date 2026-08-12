import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle } from 'lucide-react';
import { Button, cx } from './index';

const SIZES = {
  sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-6xl',
};

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }) {
  const onKey = useCallback((e) => { if (e.key === 'Escape') onClose?.(); }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onKey]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <div
        className="fixed inset-0 bg-ink/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'relative w-full bg-paper-card rounded-lg shadow-pop my-auto animate-fade-up',
          SIZES[size]
        )}
      >
        <header className="flex items-start justify-between gap-3 px-5 py-3.5 border-b border-line">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            {subtitle && <p className="text-2xs text-ink-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1 -m-1 text-ink-300 hover:text-ink rounded transition-colors"
            aria-label="Close"
          >
            <X size={17} />
          </button>
        </header>

        <div className="px-5 py-4 max-h-[calc(100vh-16rem)] overflow-y-auto">{children}</div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-line bg-paper rounded-b-lg">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body
  );
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, message, confirmLabel = 'Confirm',
  variant = 'danger', loading,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      }
    >
      <div className="flex gap-3">
        <div className={cx(
          'w-8 h-8 rounded shrink-0 flex items-center justify-center',
          variant === 'danger' ? 'bg-signal-dangerBg' : 'bg-signal-warnBg'
        )}>
          <AlertTriangle
            size={16}
            className={variant === 'danger' ? 'text-signal-danger' : 'text-signal-warn'}
          />
        </div>
        <p className="text-sm text-ink-700 leading-relaxed pt-1">{message}</p>
      </div>
    </Modal>
  );
}

/** Right side se aane wala panel — order detail wagairah ke liye */
export function Drawer({ open, onClose, title, subtitle, children, footer, width = 'max-w-2xl' }) {
  const onKey = useCallback((e) => { if (e.key === 'Escape') onClose?.(); }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onKey]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className={cx('relative w-full bg-paper-card shadow-pop flex flex-col animate-slide-in', width)}
      >
        <header className="flex items-start justify-between gap-3 px-5 py-3.5 border-b border-line shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            {subtitle && <p className="text-2xs text-ink-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1 -m-1 text-ink-300 hover:text-ink" aria-label="Close">
            <X size={17} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-line shrink-0">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body
  );
}
