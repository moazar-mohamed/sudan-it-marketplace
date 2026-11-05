import { useState } from 'react';
import { PageHeader } from '../components/ui';
import { useTheme, type ThemePreference } from '../theme/theme';
import { useUi, type Density } from '../theme/ui';

/*
 * An internal page (no link in the menu) that shows the panel's design system: the
 * density and theme switches, the colour and shape tokens, and the seeds of the
 * components. It is how a change to the look is reviewed before a real page uses it.
 */

const COLOR_GROUPS: { title: string; tokens: string[] }[] = [
  {
    title: 'الهوية والإجراء',
    tokens: ['color-brand-primary', 'color-brand-primary-hover', 'color-brand-primary-subtle', 'color-brand-secondary', 'color-text-brand'],
  },
  { title: 'الأسطح', tokens: ['color-bg-app', 'color-bg-surface', 'color-bg-subtle', 'color-bg-muted', 'color-bg-hover', 'color-bg-inverse'] },
  {
    title: 'النص والحدود',
    tokens: ['color-text-primary', 'color-text-secondary', 'color-text-tertiary', 'color-border-default', 'color-border-input', 'color-icon-default'],
  },
  {
    title: 'الحالات',
    tokens: [
      'color-success-subtle',
      'color-success-text',
      'color-warning-subtle',
      'color-warning-text',
      'color-error-subtle',
      'color-error-text',
      'color-info-subtle',
      'color-info-text',
    ],
  },
];

const SPACING_RADII = [
  { name: 'radius-xs', value: 'var(--radius-xs)' },
  { name: 'radius-sm', value: 'var(--radius-sm)' },
  { name: 'v2-radius-control', value: 'var(--v2-radius-control)' },
  { name: 'v2-radius-card', value: 'var(--v2-radius-card)' },
  { name: 'v2-radius-shell', value: 'var(--v2-radius-shell)' },
];

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'حسب الجهاز' },
  { value: 'light', label: 'فاتح' },
  { value: 'dark', label: 'داكن' },
];

const DENSITIES: { value: Density; label: string }[] = [
  { value: 'comfortable', label: 'مريح' },
  { value: 'compact', label: 'مضغوط' },
];

const sectionStyle = { display: 'flex', flexDirection: 'column', gap: 12 } as const;
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 } as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={sectionStyle} aria-label={title}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Swatch({ token }: { token: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        data-testid={`swatch-${token}`}
        style={{ height: 56, borderRadius: 12, border: '1px solid var(--color-border-default)', background: `var(--${token})` }}
      />
      <code className="mono muted" style={{ fontSize: 11 }} dir="ltr">
        {token.replace('color-', '')}
      </code>
    </div>
  );
}

export function DesignSystemPage() {
  const { density, setDensity } = useUi();
  const { theme, setTheme } = useTheme();
  const [chip, setChip] = useState('all');
  const [tab, setTab] = useState('products');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <PageHeader title="سيستم التصميم" subtitle="صفحة داخلية لمراجعة شكل اللوحة. لا تظهر في القائمة." />

      <Section title="المفاتيح">
        <div className="ds-card" style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center' }}>
          <div role="group" aria-label="الكثافة" style={{ display: 'flex', gap: 8 }}>
            {DENSITIES.map((d) => (
              <button
                key={d.value}
                type="button"
                className="ds-chip"
                aria-pressed={density === d.value}
                onClick={() => setDensity(d.value)}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div role="group" aria-label="المظهر" style={{ display: 'flex', gap: 8 }}>
            {THEMES.map((th) => (
              <button
                key={th.value}
                type="button"
                className="ds-chip"
                aria-pressed={theme === th.value}
                onClick={() => setTheme(th.value)}
              >
                {th.label}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section title="الألوان">
        {COLOR_GROUPS.map((g) => (
          <div key={g.title} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h3>{g.title}</h3>
            <div style={gridStyle}>
              {g.tokens.map((token) => (
                <Swatch key={token} token={token} />
              ))}
            </div>
          </div>
        ))}
      </Section>

      <Section title="الخط">
        <div className="ds-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 28, fontWeight: 800 }}>عنوان الصفحة 28 / 800</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>عنوان بطاقة 18 / 800</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>نص أساسي 14 / 600</div>
          <div style={{ fontSize: 14 }}>نص عادي 14 / 400 في الجداول والنماذج والأوصاف.</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>تعليق 12: وقت أو عنوان عمود</div>
        </div>
      </Section>

      <Section title="الزوايا والظل">
        <div style={{ ...gridStyle, alignItems: 'end' }}>
          {SPACING_RADII.map((r) => (
            <div key={r.name} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ height: 64, border: '2px solid var(--color-brand-primary)', borderRadius: r.value }} />
              <code className="mono muted" style={{ fontSize: 11 }} dir="ltr">
                {r.name}
              </code>
            </div>
          ))}
          {[1, 2, 3].map((n) => (
            <div key={n} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ height: 64, borderRadius: 16, background: 'var(--color-bg-surface)', boxShadow: `var(--elevation-${n})` }} />
              <code className="mono muted" style={{ fontSize: 11 }} dir="ltr">
                elevation-{n}
              </code>
            </div>
          ))}
        </div>
      </Section>

      <Section title="الأزرار والحالات">
        <div className="ds-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <button type="button" className="ds-btn ds-btn--primary">
              رئيسي
            </button>
            <button type="button" className="ds-btn">
              ثانوي
            </button>
            <button type="button" className="ds-btn ds-btn--danger">
              حساس
            </button>
            <button type="button" className="ds-btn ds-btn--ghost">
              هادئ
            </button>
            <button type="button" className="ds-btn ds-btn--sm">
              صغير
            </button>
            <button type="button" className="ds-btn ds-btn--icon" aria-label="المزيد">
              ⋯
            </button>
            <button type="button" className="ds-btn" disabled>
              معطّل
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span className="ds-pill ds-pill--success">مكتمل</span>
            <span className="ds-pill ds-pill--warning">قيد المعالجة</span>
            <span className="ds-pill ds-pill--danger">ملغي</span>
            <span className="ds-pill ds-pill--info">جديد</span>
            <span className="ds-pill">موقوف</span>
          </div>
        </div>
      </Section>

      <Section title="رقائق وتبويبات وحقول">
        <div className="ds-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div role="tablist" aria-label="تبويبات" className="ds-tabs" style={{ alignSelf: 'flex-start' }}>
            {[
              ['products', 'المنتجات'],
              ['services', 'الخدمات'],
              ['categories', 'التصنيفات'],
              ['offers', 'العروض'],
            ].map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>
          <div role="group" aria-label="رقائق الحالة" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              ['all', 'الكل', '1,284'],
              ['processing', 'قيد المعالجة', '34'],
              ['done', 'مكتمل', '1,190'],
            ].map(([id, label, count]) => (
              <button key={id} type="button" className="ds-chip" aria-pressed={chip === id} onClick={() => setChip(id)}>
                {label} <small>{count}</small>
              </button>
            ))}
          </div>
          <label className="ds-input" style={{ maxWidth: 420 }}>
            <input type="search" placeholder="رقم الطلب أو اسم الشركة" aria-label="بحث" />
          </label>
        </div>
      </Section>

      <Section title="صفوف القائمة (تتبع الكثافة)">
        <div className="ds-card" style={{ padding: 0, overflow: 'hidden' }}>
          {[
            ['نور للحاسوب', '#1042 · قبل 12 دقيقة', 'warning', 'قيد المعالجة'],
            ['Sudan Print Hub', '#1041 · قبل ساعة', 'success', 'مكتمل'],
            ['بيت التقنية', '#1040 · قبل 3 ساعات', 'danger', 'ملغي'],
          ].map(([name, meta, tone, status]) => (
            <div key={name} className="ds-row">
              <div style={{ flex: 1 }}>
                <b>{name}</b>
                <small>{meta}</small>
              </div>
              <span className={`ds-pill ds-pill--${tone}`}>{status}</span>
              <button type="button" className="ds-btn ds-btn--sm ds-btn--icon" aria-label="المزيد">
                ⋯
              </button>
            </div>
          ))}
        </div>
      </Section>

      <Section title="قائمة «⋯» ومجموعات الإجراءات">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
          <div className="ds-menu" role="menu" aria-label="قائمة الإجراءات">
            <button type="button" role="menuitem">
              عرض التفاصيل
            </button>
            <button type="button" role="menuitem">
              عرض إيصال الدفع
            </button>
            <button type="button" role="menuitem">
              محادثة الطلب
            </button>
            <button type="button" role="menuitem" className="is-danger">
              إلغاء الطلب بسبب…
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 320 }}>
            <div className="ds-group">
              <h3>إجراءات الطلب</h3>
              <button type="button" className="ds-btn ds-btn--primary">
                مراجعة إيصال الدفع
              </button>
              <button type="button" className="ds-btn">
                فتح محادثة الطلب
              </button>
            </div>
            <div className="ds-group ds-group--danger">
              <h3>منطقة حساسة</h3>
              <button type="button" className="ds-btn ds-btn--danger">
                إلغاء الطلب بسبب…
              </button>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
