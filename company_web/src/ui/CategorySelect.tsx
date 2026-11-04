import { useMemo, useState } from 'react';
import type { CategoryChoice } from '../data/categories';
import { Icon } from './Icon';
import { Modal } from './kit';

/** Pick one category from the flat "path" list, with a search box. */
export function CategorySelect({
  choices,
  value,
  currentLabel,
  onChange,
  error,
}: {
  choices: CategoryChoice[];
  value: string | null;
  /** The label of the stored category, shown even if it can no longer be picked. */
  currentLabel: string;
  onChange: (id: string) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const list = useMemo(() => choices.filter((c) => c.label.toLowerCase().includes(q.trim().toLowerCase())), [choices, q]);
  return (
    <div className="fld">
      <span className="lab" id="cat-label">التصنيف</span>
      <button
        type="button"
        className={`inp${error ? ' err' : ''}`}
        style={{ textAlign: 'start', display: 'flex', alignItems: 'center', gap: 8 }}
        aria-labelledby="cat-label"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <span className="grow ellipsis" style={{ color: value ? undefined : 'var(--muted)' }}>{value ? currentLabel || value : 'اختر التصنيف'}</span>
        <Icon name="down" size="sm" />
      </button>
      {error && <span className="errt">{error}</span>}
      {open && (
        <Modal
          title="اختر التصنيف"
          onClose={() => setOpen(false)}
          wide
          footer={<button type="button" className="btn" onClick={() => setOpen(false)}>إغلاق</button>}
        >
          <label className="search" style={{ maxWidth: 'none' }}>
            <Icon name="search" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث في التصنيفات" aria-label="بحث في التصنيفات" />
          </label>
          <div style={{ maxHeight: 360, overflow: 'auto', border: '1px solid var(--line)', borderRadius: 12 }}>
            {list.length === 0 && <div className="center">لا تصنيفات مطابقة.</div>}
            {list.map((c) => (
              <button
                key={c.id}
                type="button"
                className="lr"
                style={{ width: '100%', background: c.id === value ? 'var(--brand-tint)' : 'var(--surface)', border: 0, borderBottom: '1px solid var(--line)', textAlign: 'start' }}
                onClick={() => { onChange(c.id); setOpen(false); setQ(''); }}
              >
                <span className="grow">{c.label}</span>
                {c.id === value && <Icon name="check" />}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
