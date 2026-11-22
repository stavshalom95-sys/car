import {
  createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode,
} from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import type { Severity } from '../lib/calc';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-blue-700 text-white hover:bg-blue-800 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400',
  secondary: 'bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
  danger: 'bg-red-700 text-white hover:bg-red-800 dark:bg-red-500 dark:text-slate-950 dark:hover:bg-red-400',
  ghost: 'text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800',
};

export function Button({ variant = 'primary', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...p}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50',
        VARIANTS[variant], className,
      )}
    />
  );
}

export function IconButton({ label, className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...p}
      aria-label={label}
      title={label}
      className={cx('inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800', className)}
    />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('card', className)}>{children}</div>;
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs muted">{hint}</span>}
    </label>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon, text, action }: { icon?: ReactNode; text: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 py-10 text-center">
      {icon && <div className="text-slate-400 dark:text-slate-500">{icon}</div>}
      <p className="muted">{text}</p>
      {action}
    </div>
  );
}

const SEVERITY_STYLE: Record<Severity, string> = {
  overdue: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  urgent: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  soon: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  ok: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  missing: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

export const SEVERITY_BORDER: Record<Severity, string> = {
  overdue: 'border-s-4 border-s-red-600 dark:border-s-red-400',
  urgent: 'border-s-4 border-s-orange-500 dark:border-s-orange-400',
  soon: 'border-s-4 border-s-amber-400',
  ok: 'border-s-4 border-s-emerald-500',
  missing: 'border-s-4 border-s-slate-400',
};

export function Badge({ severity, children }: { severity: Severity; children: ReactNode }) {
  return <span className={cx('inline-block rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', SEVERITY_STYLE[severity])}>{children}</span>;
}

export function Alert({ tone = 'warning', children }: { tone?: 'warning' | 'error' | 'info'; children: ReactNode }) {
  const styles = {
    warning: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200',
    error: 'border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950/60 dark:text-red-200',
    info: 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950/60 dark:text-blue-200',
  };
  return (
    <div className={cx('flex gap-2 rounded-xl border p-3 text-sm', styles[tone])}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="space-y-1">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal (bottom sheet on mobile, centered dialog on desktop)
// ---------------------------------------------------------------------------

export function Modal({ open, title, onClose, children, footer }: {
  open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title}
        className="flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white shadow-xl sm:max-w-lg sm:rounded-3xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <h2 className="text-lg font-semibold">{title}</h2>
          <IconButton label="סגירה" onClick={onClose}><X className="h-5 w-5" /></IconButton>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex gap-2 border-t border-slate-200 px-5 py-3 pb-safe dark:border-slate-800">{footer}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirm dialog - every delete goes through this
// ---------------------------------------------------------------------------

interface ConfirmOpts { title: string; message: ReactNode; confirmText?: string; danger?: boolean }
const ConfirmCtx = createContext<((o: ConfirmOpts) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOpts | null>(null);
  const resolver = useRef<(v: boolean) => void>(undefined);
  const confirm = useCallback((o: ConfirmOpts) => {
    setOpts(o);
    return new Promise<boolean>((res) => { resolver.current = res; });
  }, []);
  const close = (v: boolean) => { resolver.current?.(v); setOpts(null); };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal open={!!opts} title={opts?.title ?? ''} onClose={() => close(false)}
        footer={<>
          <Button variant={opts?.danger === false ? 'primary' : 'danger'} className="flex-1" onClick={() => close(true)}>{opts?.confirmText ?? 'מחיקה'}</Button>
          <Button variant="secondary" className="flex-1" onClick={() => close(false)}>ביטול</Button>
        </>}>
        <div className="text-slate-700 dark:text-slate-300">{opts?.message}</div>
      </Modal>
    </ConfirmCtx.Provider>
  );
}

export function useConfirm() {
  const c = useContext(ConfirmCtx);
  if (!c) throw new Error('useConfirm outside ConfirmProvider');
  return c;
}

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

interface Toast { id: number; text: string; tone: 'success' | 'error' }
const ToastCtx = createContext<((text: string, tone?: Toast['tone']) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((text: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 2500);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div key={t.id} role="status"
            className={cx('pointer-events-auto flex max-w-md items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg',
              t.tone === 'success' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-red-700 text-white')}>
            {t.tone === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const c = useContext(ToastCtx);
  if (!c) throw new Error('useToast outside ToastProvider');
  return c;
}

/** Floating "add" button above the bottom nav */
export function Fab({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} aria-label={label}
      className="fixed bottom-24 left-5 z-40 flex h-14 items-center gap-2 rounded-full bg-blue-700 px-5 text-white shadow-lg hover:bg-blue-800 sm:bottom-8 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400">
      <span className="text-2xl leading-none">+</span>
      <span className="font-medium">{label}</span>
    </button>
  );
}
