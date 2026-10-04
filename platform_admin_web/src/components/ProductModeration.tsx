import { useState } from 'react';
import { endProductOffer, setProductHidden } from '../data/actions';
import { hasRunningOffer } from '../data/stats';
import type { Product } from '../data/types';
import { useNow } from '../data/useNow';
import { useI18n } from '../i18n/I18nProvider';
import { useConfirm, useRunner } from './feedback';
import { ReasonDialog } from './ReasonDialog';
import { Card } from './ui';

/**
 * What Platform Admin may do to a company's product: hide it from customers
 * (with a reason the company sees) or show it again, and end a running offer.
 * Price, stock and everything else stay the company's.
 */
export function ProductModeration({ product }: { product: Product }) {
  const { t, money, dateTime } = useI18n();
  const confirm = useConfirm();
  const { busy, run } = useRunner();
  const now = useNow();
  const [hiding, setHiding] = useState(false);
  const offerRunning = hasRunningOffer(product, now);

  const show = () => run('show', () => setProductHidden(product, false), t('product.shown.done'));

  const endOffer = async () => {
    const ok = await confirm({
      title: t('product.endOfferTitle'),
      body: t('product.endOfferBody', { name: product.name }),
      confirmLabel: t('product.endOffer'),
      danger: true,
    });
    if (ok) await run('offer', () => endProductOffer(product), t('product.offer.done'));
  };

  return (
    <Card title={t('product.moderation')}>
      <p className="muted">{t('product.moderationHint')}</p>
      <dl className="kv-list">
        <div className="kv">
          <dt>{t('product.hiddenFromCustomers')}</dt>
          <dd>
            {product.hidden ? (
              <>
                {t('common.yes')} — <bdi>{product.hiddenReason}</bdi>
              </>
            ) : (
              t('common.no')
            )}
          </dd>
        </div>
        <div className="kv">
          <dt>{t('product.offer')}</dt>
          <dd>
            {offerRunning && product.offerPrice !== null
              ? product.offerEndsAt
                ? t('product.offerRunning', {
                    price: money(product.offerPrice, product.currency),
                    date: dateTime(product.offerEndsAt),
                  })
                : t('product.offerNoEnd', { price: money(product.offerPrice, product.currency) })
              : t('product.noOffer')}
          </dd>
        </div>
      </dl>
      <div className="modal__actions">
        {offerRunning && (
          <button className="btn btn--danger-ghost" disabled={busy === 'offer'} onClick={() => void endOffer()}>
            {t('product.endOffer')}
          </button>
        )}
        {product.hidden ? (
          <button className="btn btn--primary" disabled={busy === 'show'} onClick={() => void show()}>
            {t('product.show')}
          </button>
        ) : (
          <button className="btn btn--danger" onClick={() => setHiding(true)}>
            {t('product.hide')}
          </button>
        )}
      </div>
      {hiding && (
        <ReasonDialog
          title={t('product.hideTitle')}
          body={t('product.hideBody', { name: product.name })}
          label={t('product.hiddenReason')}
          confirmLabel={t('product.hide')}
          danger
          onClose={() => setHiding(false)}
          onSubmit={(reason) => run('hide', () => setProductHidden(product, true, reason), t('product.hidden.done'))}
        />
      )}
    </Card>
  );
}
