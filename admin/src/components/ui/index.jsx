import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

const cx = (...c) => c.filter(Boolean).join(' ');

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------
const BTN_VARIANTS = {
  primary: 'bg-teal text-white border-teal hover:bg-teal-dark hover:border-teal-dark',
  secondary: 'bg-white text-ink border-line hover:bg-paper-sunk hover:border-line-strong',
  ghost: 'bg-transparent text-ink-500 border-transparent hover:bg-paper-sunk hover:text-ink',
  danger: 'bg-signal-danger text-white border-signal-danger hover:bg-[#8E1E17] hover:border-[#8E1E17]',
  dangerGhost: 'bg-transparent text-signal-danger border-transparent hover:bg-signal-dangerBg',
  dark: 'bg-ink text-white border-ink hover:bg-ink-700 hover:border-ink-700',
};

const BTN_SIZES = {
  xs: 'text-2xs px-2 py-1 gap-1',
  sm: 'text-[0.8125rem] px-2.5 py-1.5 gap-1.5',
  md: 'text-sm px-3.5 py-2 gap-2',
  lg: 'text-sm px-5 py-2.5 gap-2',
};

export const Button = forwardRef(function Button(
  { variant = 'secondary', size = 'md', loading, icon: Icon, children, className, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center font-medium border rounded transition-colors whitespace-nowrap',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        BTN_VARIANTS[variant], BTN_SIZES[size], className
      )}
      {...props}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : Icon && <Icon size={14} />}
      {children}
    </button>
  );
});

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------
export function Field({ label, error, hint, required, children, className }) {
  return (
    <div className={className}>
      {label && (
        <label className="label">
          {label}
          {required && <span className="text-signal-danger ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error && <p className="text-2xs text-signal-danger mt-1">{error}</p>}
      {hint && !error && <p className="text-2xs text-ink-500 mt-1">{hint}</p>}
    </div>
  );
}

export const Input = forwardRef(function Input({ className, mono, ...props }, ref) {
  return <input ref={ref} className={cx('field', mono && 'font-mono', className)} {...props} />;
});

export const Textarea = forwardRef(function Textarea({ className, rows = 4, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={cx('field resize-y', className)} {...props} />;
});

export const Select = forwardRef(function Select({ className, options = [], placeholder, children, ...props }, ref) {
  return (
    <select ref={ref} className={cx('field appearance-none bg-no-repeat pr-8', className)} {...props}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23546A78' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundPosition: 'right 10px center',
      }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => {
        const val = typeof o === 'string' ? o : o.value;
        const lbl = typeof o === 'string' ? o : o.label;
        return <option key={val} value={val}>{lbl}</option>;
      })}
      {children}
    </select>
  );
});

export function Checkbox({ label, className, ...props }) {
  return (
    <label className={cx('flex items-center gap-2 cursor-pointer select-none', className)}>
      <input
        type="checkbox"
        className="w-4 h-4 rounded border-line-strong text-teal focus:ring-teal focus:ring-offset-0 cursor-pointer"
        {...props}
      />
      {label && <span className="text-sm text-ink">{label}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label, disabled }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={!!checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative w-9 h-5 rounded-full transition-colors shrink-0 disabled:opacity-50',
          checked ? 'bg-teal' : 'bg-line-strong'
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm',
            checked && 'translate-x-4'
          )}
        />
      </button>
      {label && <span className="text-sm text-ink">{label}</span>}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Card + section
// ---------------------------------------------------------------------------
export function Card({ title, subtitle, action, children, className, bodyClass, dense }) {
  return (
    <section className={cx('card', className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-4 py-3 border-b border-line">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-ink truncate">{title}</h2>}
            {subtitle && <p className="text-2xs text-ink-500 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cx(dense ? '' : 'p-4', bodyClass)}>{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Status pill — TONE_CLASS constants.js se aata hai
// ---------------------------------------------------------------------------
import { TONE_CLASS, toneOf } from '@/lib/constants';

export function StatusPill({ status, tone, size = 'sm' }) {
  const t = tone || toneOf(status);
  return (
    <span
      className={cx(
        'inline-flex items-center border rounded font-medium whitespace-nowrap',
        size === 'xs' ? 'text-2xs px-1.5 py-0.5' : 'text-2xs px-2 py-1',
        TONE_CLASS[t]
      )}
    >
      {status}
    </span>
  );
}

/** Order kis platform se aaya — web ya app */
export function SourceTag({ source }) {
  const isApp = source === 'app';
  return (
    <span
      className={cx(
        'inline-flex items-center text-2xs font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border',
        isApp ? 'bg-teal-light text-teal-dark border-teal/25' : 'bg-paper-sunk text-ink-500 border-line'
      )}
    >
      {source || 'web'}
    </span>
  );
}

/** Signature element: har identifier mono me */
export function Code({ children, className, chip }) {
  if (!children) return <span className="text-ink-300">—</span>;
  return <span className={cx(chip ? 'code-chip' : 'code', className)}>{children}</span>;
}

// ---------------------------------------------------------------------------
// Loading / empty states
// ---------------------------------------------------------------------------
export function Spinner({ size = 18, className }) {
  return <Loader2 size={size} className={cx('animate-spin text-ink-300', className)} />;
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <Spinner size={22} />
      <p className="text-sm text-ink-500">{label}</p>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {Icon && (
        <div className="w-11 h-11 rounded-lg bg-paper-sunk border border-line flex items-center justify-center mb-3">
          <Icon size={19} className="text-ink-300" />
        </div>
      )}
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && <p className="text-sm text-ink-500 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={cx('bg-paper-sunk rounded animate-pulse', className)} />;
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={cx('flex items-center gap-1 border-b border-line overflow-x-auto', className)}>
      {tabs.map((t) => {
        const active = value === t.value;
        return (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            className={cx(
              'relative px-3 py-2 text-[0.8125rem] font-medium whitespace-nowrap transition-colors -mb-px border-b-2',
              active
                ? 'text-teal border-teal'
                : 'text-ink-500 border-transparent hover:text-ink'
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cx(
                'ml-1.5 text-2xs px-1.5 py-0.5 rounded tabular-nums',
                active ? 'bg-teal-light text-teal-dark' : 'bg-paper-sunk text-ink-500'
              )}>
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export { cx };
