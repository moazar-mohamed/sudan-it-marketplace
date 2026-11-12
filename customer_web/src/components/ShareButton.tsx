import { useEffect, useState } from 'react';
import { Icon, PATHS } from './Icon';
import { t } from '../i18n';

/**
 * Shares a page of the site: the phone's own share sheet (WhatsApp, Telegram…)
 * where the browser has one, otherwise the link is copied.
 */
export function ShareButton({ title, path }: { title: string; path: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function share() {
    const url = new URL(path, window.location.origin).toString();
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text: title, url });
        return;
      } catch (e) {
        // Closing the sheet is not a failure: nothing more to do.
        if (e instanceof DOMException && e.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt(t('انسخ الرابط'), url);
    }
  }

  return (
    <button type="button" className="share-btn" onClick={() => void share()}>
      <Icon d={PATHS.share} size={18} />
      <span aria-live="polite">{copied ? t('تم نسخ الرابط') : t('مشاركة')}</span>
    </button>
  );
}
