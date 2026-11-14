import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

export type RowMenuItem = {
  key: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
  /** Draws a thin line above this item, to group the ones after it. */
  separated?: boolean;
};

type Spot = { left: number; top?: number; bottom?: number };

const MENU_WIDTH = 200;
const MENU_HEIGHT = 300;
const EDGE = 8;

/**
 * The "⋯" button of a table row and the list of actions it opens. The list is
 * drawn on the page itself (not inside the table), so a scrolling table never
 * cuts it off; it opens upward when there is no room below.
 */
export function RowMenu({
  label,
  items,
  text,
  disabled = false,
}: {
  label: string;
  items: RowMenuItem[];
  /** Shows this text on the button (with an arrow) instead of the three dots. */
  text?: string;
  disabled?: boolean;
}) {
  const [spot, setSpot] = useState<Spot | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const isOpen = spot !== null;

  useEffect(() => {
    if (!isOpen) return undefined;
    const close = () => setSpot(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // The page's own Escape handling (dialogs) must not also fire.
      e.stopPropagation();
      setSpot(null);
      button.current?.focus();
    };
    const onPress = (e: MouseEvent) => {
      const target = e.target as Node;
      if (list.current?.contains(target) || button.current?.contains(target)) return;
      setSpot(null);
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('mousedown', onPress);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('mousedown', onPress);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [isOpen]);

  const toggle = () => {
    if (isOpen) {
      setSpot(null);
      return;
    }
    const rect = button.current?.getBoundingClientRect();
    if (!rect) return;
    const rtl = document.documentElement.dir === 'rtl';
    const wanted = rtl ? rect.left : rect.right - MENU_WIDTH;
    const left = Math.max(EDGE, Math.min(wanted, window.innerWidth - MENU_WIDTH - EDGE));
    const below = window.innerHeight - rect.bottom;
    const flip = below < MENU_HEIGHT && rect.top > below;
    setSpot(
      flip
        ? { left, bottom: window.innerHeight - rect.top + 4 }
        : { left, top: rect.bottom + 4 },
    );
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        className={text ? 'btn btn--sm' : 'row-menu__button'}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={text ? undefined : label}
        title={label}
        onClick={toggle}
      >
        {text ? (
          <>
            {text} <Icon name="chevronDown" size={14} />
          </>
        ) : (
          <Icon name="moreVertical" size={18} />
        )}
      </button>
      {spot &&
        createPortal(
          <div
            ref={list}
            className="row-menu"
            role="menu"
            aria-label={label}
            style={{ left: spot.left, top: spot.top, bottom: spot.bottom, width: MENU_WIDTH }}
          >
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                className={[
                  'row-menu__item',
                  item.danger ? 'row-menu__item--danger' : '',
                  item.separated ? 'row-menu__item--separated' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                disabled={item.disabled}
                onClick={() => {
                  setSpot(null);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
