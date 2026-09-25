import { useCallback, useEffect, useRef, useState } from 'react';
import type { OrderReceipt } from '../data/receipts';
import { useI18n } from '../i18n/I18nProvider';

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'error' }
  | { status: 'ready'; url: string; receipt: OrderReceipt };

/**
 * "View receipt" for an order's payment card. The image is fetched only when
 * asked (it is up to ~700 KB and every read spends part of the free quota),
 * shown from a temporary in-memory URL that is released afterwards, and never
 * stored anywhere else. An order without a stored image says so plainly.
 */
export function ReceiptViewer({
  orderId,
  load,
}: {
  orderId: string;
  load: (orderId: string) => Promise<OrderReceipt | null>;
}) {
  const { t } = useI18n();
  const [state, setState] = useState<State>({ status: 'idle' });
  const objectUrl = useRef<string | null>(null);
  const requests = useRef(0);

  const release = () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
  };
  // Release the temporary URL when leaving the page, and forget a stale request.
  useEffect(
    () => () => {
      requests.current++;
      release();
    },
    [],
  );

  const open = useCallback(async () => {
    const request = ++requests.current;
    setState({ status: 'loading' });
    try {
      const receipt = await load(orderId);
      if (request !== requests.current) return;
      if (!receipt) {
        setState({ status: 'none' });
        return;
      }
      release();
      const blob = new Blob([receipt.bytes as BlobPart], { type: receipt.contentType });
      objectUrl.current = URL.createObjectURL(blob);
      setState({ status: 'ready', url: objectUrl.current, receipt });
    } catch {
      if (request === requests.current) setState({ status: 'error' });
    }
  }, [load, orderId]);

  const hide = () => {
    requests.current++;
    release();
    setState({ status: 'idle' });
  };

  return (
    <div className="receipt">
      {(state.status === 'idle' || state.status === 'none' || state.status === 'error') && (
        <button type="button" className="btn btn--sm" onClick={() => void open()}>
          {t('receipt.view')}
        </button>
      )}
      {state.status === 'loading' && <p className="muted">{t('common.loading')}</p>}
      {state.status === 'none' && <p className="muted">{t('receipt.none')}</p>}
      {state.status === 'error' && (
        <p className="alert alert--error" role="alert">
          {t('receipt.error')}
        </p>
      )}
      {state.status === 'ready' && (
        <>
          <a href={state.url} target="_blank" rel="noopener noreferrer" className="receipt__link">
            <img
              className="receipt__image"
              src={state.url}
              alt={t('receipt.alt')}
              width={state.receipt.width}
              height={state.receipt.height}
            />
          </a>
          <p className="muted receipt__caption">
            <bdi dir="ltr">
              {state.receipt.fileName} · {Math.round(state.receipt.bytes.length / 1024)} KB
            </bdi>
          </p>
          <button type="button" className="btn btn--sm btn--ghost" onClick={hide}>
            {t('receipt.hide')}
          </button>
        </>
      )}
    </div>
  );
}
