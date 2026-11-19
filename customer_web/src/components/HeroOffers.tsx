import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { useCatalog } from '../data/DataProvider';
import { categoryColor, countText, formatPrice, offerLabel, salePrice } from '../data/format';
import { type HeroOffer, offerTimeLeft } from '../data/heroOffers';
import { language, t } from '../i18n';
import { CategoryGlyph } from './CategoryGlyph';
import { Icon, PATHS } from './Icon';
import './HeroOffers.css';

/** How long an offer stays before the next one slides in (as the app's home). */
const AUTO_PLAY_MS = 5000;

const reducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/**
 * The big banner of the home page, as the app has it: the best running offers
 * one at a time on a navy card, swiped sideways or picked with the dots. It
 * moves on by itself every few seconds and back to the first after the last,
 * stops while a pointer or the keyboard is on it, and stays still for readers
 * who ask for no animations. Each card counts down to its offer's end.
 */
export function HeroOffers({ offers }: { offers: HeroOffer[] }) {
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const count = offers.length;
  const current = count === 0 ? 0 : Math.min(index, count - 1);

  // Moves on unless held; every change of slide restarts the full wait.
  useEffect(() => {
    if (count < 2 || held || reducedMotion()) return;
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % count), AUTO_PLAY_MS);
    return () => window.clearTimeout(timer);
  }, [current, count, held]);

  // The countdown ticks every second while an offer ends within a day, else every minute.
  const soonest = Math.min(...offers.map((o) => o.item.offerEndsAt?.getTime() ?? Number.POSITIVE_INFINITY));
  const underADay = soonest - now.getTime() < 86400000;
  useEffect(() => {
    if (!Number.isFinite(soonest)) return;
    const timer = window.setInterval(() => setNow(new Date()), underADay ? 1000 : 60000);
    return () => window.clearInterval(timer);
  }, [soonest, underADay]);

  if (count === 0) return null;

  const go = (next: number) => setIndex(((next % count) + count) % count);
  const rtl = language !== 'en';

  function down(e: PointerEvent) {
    drag.current = { x: e.clientX, moved: false };
    setHeld(true);
  }
  function up(e: PointerEvent) {
    const start = drag.current;
    if (e.pointerType !== 'mouse') setHeld(false);
    if (!start) return;
    const dx = e.clientX - start.x;
    if (Math.abs(dx) > 40) {
      start.moved = true;
      // In Arabic the next card comes in from the left, so a swipe to the right shows it.
      go(current + ((dx > 0) === rtl ? 1 : -1));
    }
  }

  return (
    <section
      className="hero-offers"
      aria-roledescription="carousel"
      aria-label={t('عروض مميزة')}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <div className="hero-offers-view" onPointerDown={down} onPointerUp={up} onPointerCancel={() => { drag.current = null; setHeld(false); }}>
        <div className="hero-offers-track" style={{ transform: `translateX(${(rtl ? 1 : -1) * current * 100}%)` }}>
          {offers.map((o, i) => (
            <Slide
              key={o.key}
              offer={o}
              now={now}
              hidden={i !== current}
              label={t('{0} من {1}', i + 1, count)}
              onClick={(e) => {
                if (drag.current?.moved) e.preventDefault();
                drag.current = null;
              }}
            />
          ))}
        </div>
      </div>
      {count > 1 && (
        <div className="hero-offers-dots">
          {offers.map((o, i) => (
            <button
              key={o.key}
              type="button"
              className={i === current ? 'on' : ''}
              aria-label={t('العرض {0}', i + 1)}
              aria-current={i === current ? 'true' : undefined}
              onClick={() => go(i)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function Slide({ offer: o, now, hidden, label, onClick }: { offer: HeroOffer; now: Date; hidden: boolean; label: string; onClick: (e: MouseEvent) => void }) {
  const { tree } = useCatalog();
  const category = o.categoryId ? tree.byId(o.categoryId) : undefined;
  const sale = salePrice(o.item, now);
  const left = o.item.offerEndsAt ? offerTimeLeft(o.item.offerEndsAt, now) : null;
  return (
    <Link
      to={o.path}
      className="hero-offer"
      role="group"
      aria-roledescription="slide"
      aria-label={label}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      onClick={onClick}
      draggable={false}
    >
      <div className="hero-offer-text">
        <span className="hero-offer-pill">{offerLabel(o.item)}</span>
        <strong className="hero-offer-name">{o.name}</strong>
        {sale !== null && (
          <span className="hero-offer-price">
            <b>{formatPrice(sale, o.currency)}</b>
            {o.item.price !== null && o.item.price !== sale && <s>{formatPrice(o.item.price, o.currency)}</s>}
          </span>
        )}
        {left && (
          'days' in left ? (
            <span className="hero-offer-ends">{t('ينتهي خلال')} {countText(left.days, t('يوم'), t('يومين'), t('أيام'), t('يوماً'))}</span>
          ) : (
            <span className="hero-offer-ends" aria-label={t('ينتهي خلال {0}', left.parts.join(':'))}>
              {t('ينتهي خلال')}
              <span className="hero-offer-clock" dir="ltr" aria-hidden="true">
                {left.parts.map((p, i) => (
                  <span key={i}>{i > 0 && <i>:</i>}<b>{p}</b></span>
                ))}
              </span>
            </span>
          )
        )}
        <span className="hero-offer-go">
          {o.kind === 'service' ? t('اطلب الخدمة') : t('تسوق الآن')}
          <Icon d={PATHS.arrow} size={18} />
        </span>
      </div>
      <span className="hero-offer-pic" style={o.imageUrl ? undefined : { background: `linear-gradient(135deg, ${categoryColor(category, o.key)}, ${categoryColor(category, o.key)}b3)` }}>
        {o.imageUrl ? <img src={o.imageUrl} alt="" loading="lazy" draggable={false} /> : category ? <CategoryGlyph category={category} size={50} /> : <Icon d={PATHS.box} size={50} />}
      </span>
    </Link>
  );
}
