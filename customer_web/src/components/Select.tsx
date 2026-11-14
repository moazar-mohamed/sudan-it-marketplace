import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface SelectOption {
  value: string;
  label: string;
  /** What the closed button shows instead of the label (a short form). */
  short?: string;
  /** Options with the same group are listed under its heading. */
  group?: string;
}

interface Spot {
  top: number;
  bottom: number;
  left: number;
  width: number;
}

/**
 * A drop-down that looks like the rest of the site (a native one cannot be styled once it
 * opens): a button that opens a floating list, with the arrow keys, Home/End, typing a letter,
 * Enter and Escape. `variant` is the closed look: "pill" for filter rows, "field" for forms.
 */
export function Select({
  value,
  onChange,
  options,
  ariaLabel,
  variant = 'field',
  className = '',
  active = false,
  disabled = false,
  dir,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  ariaLabel: string;
  variant?: 'pill' | 'field';
  className?: string;
  /** A filter that is in use: the pill is filled. */
  active?: boolean;
  disabled?: boolean;
  dir?: 'ltr' | 'rtl';
}) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [cursor, setCursor] = useState(0);
  const typed = useRef({ text: '', at: 0 });
  const open = spot !== null;

  const selected = options.findIndex((o) => o.value === value);
  const current = options[selected];

  const place = useCallback(() => {
    const r = button.current?.getBoundingClientRect();
    if (r) setSpot({ top: r.top, bottom: r.bottom, left: r.left, width: r.width });
  }, []);

  const show = () => {
    if (disabled) return;
    place();
    setCursor(Math.max(selected, 0));
  };
  const close = useCallback((refocus = true) => {
    setSpot(null);
    if (refocus) button.current?.focus();
  }, []);
  const choose = (index: number) => {
    const option = options[index];
    if (option) onChange(option.value);
    close();
  };

  // While open: a press elsewhere, a resize or a scroll outside the list closes it.
  useEffect(() => {
    if (!open) return undefined;
    const onPress = (e: MouseEvent) => {
      const target = e.target as Node;
      if (list.current?.contains(target) || button.current?.contains(target)) return;
      close(false);
    };
    const onScroll = (e: Event) => {
      if (!list.current?.contains(e.target as Node)) close(false);
    };
    window.addEventListener('mousedown', onPress);
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('mousedown', onPress);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, close]);

  // The highlighted option stays in view.
  useLayoutEffect(() => {
    if (open) document.getElementById(`${id}-${cursor}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [open, cursor, id]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    const last = options.length - 1;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      close(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, last));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setCursor(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setCursor(last);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(cursor);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      // Typing a letter jumps to the next option that starts with what was typed.
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : '') + e.key.toLowerCase(), at: now };
      const from = options.findIndex((o, i) => i >= cursor && o.label.toLowerCase().startsWith(typed.current.text));
      const hit = from >= 0 ? from : options.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.text));
      if (hit >= 0) setCursor(hit);
    }
  };

  const groups = useMemo(() => {
    const out: { name: string; items: { option: SelectOption; index: number }[] }[] = [];
    options.forEach((option, index) => {
      const name = option.group ?? '';
      let g = out[out.length - 1];
      if (!g || g.name !== name) {
        g = { name, items: [] };
        out.push(g);
      }
      g.items.push({ option, index });
    });
    return out;
  }, [options]);

  // Opens upward when there is more room above than below.
  const room = spot ? { below: window.innerHeight - spot.bottom - 12, above: spot.top - 12 } : null;
  const upward = !!room && room.below < 220 && room.above > room.below;
  const maxHeight = room ? Math.max(160, Math.min(320, upward ? room.above : room.below)) : 320;
  const width = spot ? Math.max(spot.width, variant === 'pill' ? 200 : spot.width) : undefined;
  const left = spot ? Math.min(Math.max(8, spot.left), Math.max(8, window.innerWidth - (width ?? 0) - 8)) : 0;

  return (
    <>
      <button
        ref={button}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-activedescendant={open ? `${id}-${cursor}` : undefined}
        disabled={disabled}
        dir={dir}
        className={`select-btn select-btn--${variant}${active ? ' on' : ''}${open ? ' open' : ''}${className ? ` ${className}` : ''}`}
        onClick={() => (open ? close() : show())}
        onKeyDown={onKeyDown}
      >
        <span className="select-value">{current ? current.short ?? current.label : ''}</span>
        <svg className="select-chevron" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open &&
        spot &&
        createPortal(
          <div
            ref={list}
            id={`${id}-list`}
            role="listbox"
            aria-label={ariaLabel}
            className={`select-list${upward ? ' select-list--up' : ''}`}
            dir={dir ?? document.documentElement.dir}
            style={{
              left,
              width,
              maxHeight,
              ...(upward ? { bottom: window.innerHeight - spot.top + 6 } : { top: spot.bottom + 6 }),
            }}
            onKeyDown={onKeyDown}
          >
            {groups.map((g) => (
              <div key={g.name || '_'} role={g.name ? 'group' : undefined} aria-label={g.name || undefined}>
                {g.name && <p className="select-group">{g.name}</p>}
                {g.items.map(({ option, index }) => (
                  <div
                    key={option.value}
                    id={`${id}-${index}`}
                    role="option"
                    aria-selected={index === selected}
                    className={`select-option${index === cursor ? ' is-cursor' : ''}${index === selected ? ' is-selected' : ''}`}
                    onMouseMove={() => setCursor(index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(index)}
                  >
                    <span>{option.label}</span>
                    {index === selected && (
                      <svg className="select-check" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
