import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Spinner, Modal } from './kit';
import { t } from '../i18n';

// OpenStreetMap tiles need no key or billing, as in the app (map_config.dart).
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '© OpenStreetMap contributors';
/** Where the map opens when nothing is selected yet: Khartoum. */
const DEFAULT_CENTER: L.LatLngTuple = [15.5007, 32.5599];
const DEFAULT_ZOOM = 12;
const SELECTED_ZOOM = 16;

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

const pin = L.divIcon({ className: 'map-pin', iconSize: [22, 22], iconAnchor: [11, 11] });

/** Click the map to choose an exact point, click again to move it, then confirm. */
export default function MapPicker({
  initial,
  onConfirm,
  onClose,
}: {
  initial: GeoPoint | null;
  onConfirm: (point: GeoPoint) => void;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const [selected, setSelected] = useState<GeoPoint | null>(initial);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!box.current) return;
    const start: L.LatLngTuple = initial ? [initial.latitude, initial.longitude] : DEFAULT_CENTER;
    const created = L.map(box.current).setView(start, initial ? SELECTED_ZOOM : DEFAULT_ZOOM);
    L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(created);
    created.on('click', (e: L.LeafletMouseEvent) => setSelected({ latitude: e.latlng.lat, longitude: e.latlng.lng }));
    map.current = created;
    // The dialog may still be settling when the map is made: follow the box's real size.
    const watcher = new ResizeObserver(() => created.invalidateSize());
    watcher.observe(box.current);
    return () => {
      watcher.disconnect();
      created.remove();
      map.current = null;
      marker.current = null;
    };
    // The map is created once; `selected` drives the marker below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const current = map.current;
    if (!current || !selected) return;
    const at: L.LatLngTuple = [selected.latitude, selected.longitude];
    if (marker.current) marker.current.setLatLng(at);
    else marker.current = L.marker(at, { icon: pin }).addTo(current);
  }, [selected]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setNote(t('متصفحك لا يدعم تحديد الموقع. اضغط على الخريطة.'));
      return;
    }
    setLocating(true);
    setNote('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        setSelected(point);
        map.current?.setView([point.latitude, point.longitude], SELECTED_ZOOM);
        setLocating(false);
      },
      (error) => {
        setNote(error.code === 1 ? t('تم رفض إذن الموقع. يمكنك الضغط على الخريطة.') : t('تعذّر الحصول على موقعك الحالي. يمكنك الضغط على الخريطة.'));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  return (
    <Modal
      xl
      title={t('تحديد الموقع على الخريطة')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn p" disabled={!selected} onClick={() => selected && onConfirm(selected)}>{t('تأكيد الموقع')}</button>
          <button type="button" className="btn" disabled={locating} onClick={useMyLocation}>{locating && <Spinner />}{t('استخدام موقعي الحالي')}</button>
          <button type="button" className="btn g" onClick={onClose}>{t('إلغاء')}</button>
        </>
      }
    >
      <p className="muted">{t('اضغط على الخريطة لتحديد النقطة بدقة، واضغط مرة أخرى لتحريكها.')}</p>
      <div className="map-box" ref={box} dir="ltr" />
      {selected && <span className="sub num">{selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}</span>}
      {note && <span className="errt">{note}</span>}
    </Modal>
  );
}
