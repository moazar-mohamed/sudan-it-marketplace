import { useState } from 'react';
import type { MouseEvent } from 'react';
import { useCatalog } from '../data/DataProvider';
import { favoriteKey, setFavorite } from '../data/favorites';
import type { FavoriteKind } from '../data/types';
import { t } from '../i18n';
import { Icon, PATHS } from './Icon';
import { useAskToSignIn } from './RequireAccount';

/** The heart that saves a product or service. On a card it never opens the card. A visitor is asked to sign in. */
export function FavoriteButton({ kind, targetId, name, className = '' }: { kind: FavoriteKind; targetId: string; name: string; className?: string }) {
  const { favorites, profile } = useCatalog();
  const askToSignIn = useAskToSignIn();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const key = favoriteKey(kind, targetId);
  const saved = favorites?.some((f) => favoriteKey(f.kind, f.targetId) === key) ?? false;
  const label = failed ? t('تعذر حفظ التغيير. حاول مرة أخرى.') : saved ? t('إزالة من المفضلة') : t('إضافة إلى المفضلة');

  async function toggle(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!profile) return askToSignIn();
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await setFavorite(profile.id, kind, targetId, name, !saved);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={`fav-btn${saved ? ' on' : ''}${failed ? ' failed' : ''}${busy ? ' busy' : ''} ${className}`} aria-pressed={saved} aria-busy={busy} aria-label={label} title={label} onClick={toggle}>
      <Icon d={PATHS.heart} size={20} />
    </button>
  );
}
