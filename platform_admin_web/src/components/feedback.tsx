import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { Modal } from './ui';

/* ---------- Toasts ---------- */

interface ToastItem {
  id: number;
  kind: 'success' | 'error';
  message: string;
}
type ToastFn = (message: string, kind?: ToastItem['kind']) => void;
const ToastContext = createContext<ToastFn | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const toast = useCallback<ToastFn>((message, kind = 'success') => {
    const id = nextId.current++;
    setItems((prev) => [...prev, { id, kind, message }]);
    window.setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), 4500);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className={`toast toast--${i.kind}`}>
            {i.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastFn {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

/* ---------- Confirmation dialog ---------- */

interface ConfirmOptions {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
}
type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;
const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  };

  const value = useMemo(() => confirm, [confirm]);
  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {options && (
        <Modal title={options.title} onClose={() => settle(false)} narrow>
          <p className="modal__text">{options.body}</p>
          <div className="modal__actions">
            <button className="btn" onClick={() => settle(false)}>
              {t('common.cancel')}
            </button>
            <button
              className={options.danger ? 'btn btn--danger' : 'btn btn--primary'}
              onClick={() => settle(true)}
            >
              {options.confirmLabel}
            </button>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider');
  return ctx;
}

/* ---------- Running a write with feedback ---------- */

export function useRunner() {
  const { t } = useI18n();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const run = useCallback(
    async <R,>(key: string, action: () => Promise<R>, successMessage: string | ((result: R) => string)) => {
      setBusy(key);
      try {
        const result = await action();
        toast(typeof successMessage === 'function' ? successMessage(result) : successMessage, 'success');
        return true;
      } catch (error) {
        const code = (error as { code?: string } | null)?.code;
        toast(
          code === 'permission-denied'
            ? t('error.actionPermission')
            : code === 'image-upload-failed'
              ? t('image.uploadFailed')
              : code === 'company-account/email-in-use'
                ? t('companies.error.emailInUse')
                : code === 'company-account/invalid-email'
                  ? t('companies.emailRequired')
                  : code === 'company-account/weak-password'
                    ? t('companies.error.weakPassword')
                    : t('error.action'),
          'error',
        );
        return false;
      } finally {
        setBusy(null);
      }
    },
    [t, toast],
  );

  return { busy, run };
}
