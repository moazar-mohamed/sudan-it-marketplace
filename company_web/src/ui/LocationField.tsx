import { lazy, Suspense, useState } from 'react';
import { Icon } from './Icon';
import { t } from '../i18n';

// Leaflet is large: it loads only when the map is first opened.
const MapPicker = lazy(() => import('./MapPicker'));

/** A place picked on the map. Both numbers are set, or both are null (no location). */
export function LocationField({
  latitude,
  longitude,
  onChange,
  label = t('الموقع على الخريطة'),
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (latitude: number | null, longitude: number | null) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const has = latitude !== null && longitude !== null;
  return (
    <div className="fld">
      <span className="lab">{label} <span className="muted">{t('(اختياري)')}</span></span>
      <div className="row wrap" style={{ gap: 8 }}>
        <button type="button" className="btn" onClick={() => setOpen(true)}>
          <Icon name="pin" />
          {has ? t('تغيير الموقع على الخريطة') : t('تحديد على الخريطة')}
        </button>
        {has && <button type="button" className="btn g" onClick={() => onChange(null, null)}>{t('إزالة الموقع')}</button>}
        {has && <span className="sub num">{latitude.toFixed(5)}, {longitude.toFixed(5)}</span>}
      </div>
      {open && (
        <Suspense fallback={null}>
          <MapPicker
            initial={has ? { latitude, longitude } : null}
            onConfirm={(p) => { onChange(p.latitude, p.longitude); setOpen(false); }}
            onClose={() => setOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
