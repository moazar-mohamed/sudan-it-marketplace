import { useMemo, useState } from 'react';
import { useCompanyData } from '../data/CompanyData';
import { useCategoryLookup } from '../data/categories';
import { ago, discountPercent, hasActiveOffer, money, parseNumber } from '../data/format';
import {
  addCompanyService,
  createOwnService,
  nextRequestStatuses,
  removeOwnService,
  REQUEST_LABEL,
  ServiceError,
  setRequestStatus,
  setServiceActive,
  updateCompanyService,
  updateOwnService,
  useCatalogServices,
  useCompanyServices,
  useServiceRequests,
  type ServiceRequest,
} from '../data/services';
import type { CatalogService, CompanyService } from '../data/types';
import { CategorySelect } from '../ui/CategorySelect';
import { Icon } from '../ui/Icon';
import { Banner, Chip, ConfirmDialog, Empty, Loading, Modal, PageHeader, Spinner, Switch, type Tone } from '../ui/kit';
import { useToast } from '../ui/toast';
import { t } from '../i18n';

const REQUEST_TONE: Record<string, Tone> = { pending: 'warn', accepted: 'info', in_progress: 'info', completed: 'ok', rejected: 'n', cancelled: 'n' };
const ACTION_LABEL: Record<string, string> = { accepted: t('قبول'), rejected: t('رفض'), in_progress: t('بدء التنفيذ'), completed: t('تم الإنجاز') };

export function ServicesPage() {
  const { companyId, categories } = useCompanyData();
  const links = useCompanyServices(companyId);
  const catalog = useCatalogServices(companyId);
  const requests = useServiceRequests(companyId);
  const lookup = useCategoryLookup(categories);
  const toast = useToast();
  const [form, setForm] = useState<{ link?: CompanyService; service?: CatalogService } | null>(null);
  const [removing, setRemoving] = useState<{ link: CompanyService; service?: CatalogService } | null>(null);
  const [busy, setBusy] = useState(false);

  const byId = useMemo(() => new Map((catalog ?? []).map((s) => [s.id, s])), [catalog]);
  if (links === null || catalog === null) return <main className="page"><Loading /></main>;

  const mine = links.filter((l) => l.isActive);
  const stopped = links.filter((l) => !l.isActive && byId.has(l.serviceId));
  const offeredIds = new Set(mine.map((l) => l.serviceId));
  const addable = catalog.filter((s) => !s.ownerCompanyId && !offeredIds.has(s.id));
  const open = (requests ?? []).filter((r) => ['pending', 'accepted', 'in_progress'].includes(r.status));

  const toggle = async (l: CompanyService, on: boolean) => {
    try { await setServiceActive(l, on); toast(on ? t('عادت الخدمة للعملاء') : t('أُوقفت الخدمة'), 'ok'); } catch { toast(t('تعذّر التحديث.'), 'err'); }
  };
  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      if (removing.service?.ownerCompanyId) await removeOwnService(removing.link); else await setServiceActive(removing.link, false);
      toast(t('أُزيلت الخدمة من عروضك'), 'ok');
      setRemoving(null);
    } catch { toast(t('تعذّرت الإزالة.'), 'err'); } finally { setBusy(false); }
  };

  return (
    <main className="page">
      <PageHeader
        title={t('الخدمات')}
        subtitle={t('الخدمات التي تقدمها شركتك، الخاصة بك وتلك المأخوذة من كتالوج المنصة')}
        actions={<button type="button" className="btn p" onClick={() => setForm({})}><Icon name="plus" />{t('خدمة جديدة')}</button>}
      />
      <div className="g2">
        <div className="stack">
          <section className="card" aria-label={t('خدماتي')}>
            <div className="card-h"><h2>{t('خدماتي')}</h2><Chip tone="n" dot={false}>{mine.length}</Chip></div>
            {mine.length === 0 ? <Empty icon="tool" text={t('لا تقدم أي خدمة بعد. أنشئ خدمة أو أضف من كتالوج المنصة.')} /> : (
              <div className="scroll">
                <table className="tbl">
                  <thead><tr><th>{t('الخدمة')}</th><th>{t('المصدر')}</th><th>{t('السعر (SDG)')}</th><th>{t('طلبات')}</th><th>{t('مفعّلة')}</th><th /></tr></thead>
                  <tbody>
                    {mine.map((l) => {
                      const s = byId.get(l.serviceId);
                      const own = !!s?.ownerCompanyId;
                      const n = (requests ?? []).filter((r) => r.status === 'pending' && r.serviceName === s?.name).length;
                      return (
                        <tr key={l.id}>
                          <td><div className="b">{s?.name ?? t('خدمة غير متاحة')}</div><div className="sub">{lookup.label(s?.categoryId ?? null)}</div></td>
                          <td><Chip tone={own ? 'info' : 'n'} dot={false}>{own ? t('خدمة خاصة') : t('من كتالوج المنصة')}</Chip></td>
                          <td>
                            <PriceCell link={l} />
                            {hasActiveOffer(l) && <div className="sub"><s className="num">{money(l.price)}</s> · <span style={{ color: 'var(--ok)', fontWeight: 700 }}>{t('عرض {0}%', discountPercent(l))}</span></div>}
                          </td>
                          <td>{n > 0 ? <Chip tone="warn">{t('{0} جديد', n)}</Chip> : <span className="sub">0</span>}</td>
                          <td><Switch on={l.isActive} onChange={(v) => void toggle(l, v)} label={t('تفعيل الخدمة')} /></td>
                          <td><div className="row" style={{ gap: 4 }}>
                            <button type="button" className="btn sm" onClick={() => setForm({ link: l, service: s })}>{t('تعديل')}</button>
                            <button type="button" className="icon-btn flat" aria-label={t('إزالة الخدمة')} onClick={() => setRemoving({ link: l, service: s })}><Icon name="trash" /></button>
                          </div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="foot"><span className="sub">{t('خدمة بلا سعر يظهر لها زر الطلب دون سعر. إيقاف الخدمة يخفيها عن العملاء وتبقى الطلبات السابقة.')}</span></div>
          </section>

          {stopped.length > 0 && (
            <section className="card" aria-label={t('خدمات موقوفة')}>
              <div className="card-h"><h3>{t('موقوفة')}</h3></div>
              {stopped.map((l) => (
                <div key={l.id} className="lr"><div className="grow b">{byId.get(l.serviceId)?.name}</div><button type="button" className="btn sm" onClick={() => setForm({ link: l, service: byId.get(l.serviceId) })}>{t('إعادة تفعيل')}</button></div>
              ))}
            </section>
          )}

          <section className="card" aria-label={t('خدمات يمكن إضافتها')}>
            <div className="card-h"><h2>{t('خدمات من كتالوج المنصة يمكنك إضافتها')}</h2></div>
            {addable.length === 0 ? <Empty icon="check" text={t('أضفت كل الخدمات المتاحة.')} /> : addable.map((s) => <AddRow key={s.id} service={s} companyId={companyId} categoryLabel={lookup.label(s.categoryId)} />)}
          </section>
        </div>

        <section className="card" aria-label={t('طلبات الخدمة المفتوحة')}>
          <div className="card-h"><h2>{t('طلبات الخدمة المفتوحة')}</h2><Chip tone="warn" dot={false}>{open.length}</Chip></div>
          <div className="card-b stack" style={{ gap: 14 }}>
            {requests === null && <Spinner />}
            {requests !== null && open.length === 0 && <Empty icon="check" text={t('لا طلبات خدمة مفتوحة.')} />}
            {open.map((r) => <RequestCard key={r.id} request={r} />)}
          </div>
        </section>
      </div>

      {form && <ServiceDialog companyId={companyId} choices={lookup.choices} lookupLabel={lookup.label} existing={form} onClose={() => setForm(null)} />}
      {removing && (
        <ConfirmDialog
          title={t('إزالة «{0}»؟', removing.service?.name ?? t('الخدمة'))}
          body={removing.service?.ownerCompanyId ? t('تُوقف الخدمة وتُخفى من الكتالوج. طلباتها السابقة تبقى.') : t('تتوقف عن عرضها للعملاء، ويمكنك إضافتها من جديد لاحقًا.')}
          confirmLabel={t('إزالة')}
          danger
          busy={busy}
          onConfirm={() => void remove()}
          onClose={() => setRemoving(null)}
        />
      )}
    </main>
  );
}

function PriceCell({ link }: { link: CompanyService }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const value = text.trim() === '' ? null : parseNumber(text);
    if (value !== null && value <= 0) { toast(t('اكتب سعرًا أكبر من صفر، أو اتركه فارغًا لخدمة بلا سعر.'), 'err'); return; }
    setBusy(true);
    try { await updateCompanyService(link, value, link.note); toast(t('تم تحديث السعر'), 'ok'); setEditing(false); }
    catch (e) { toast(e instanceof ServiceError && e.problem === 'price-below-offer' ? t('السعر يجب أن يبقى أعلى من سعر العرض الجاري. أنهِ العرض أولًا.') : t('تعذّر الحفظ.'), 'err'); }
    finally { setBusy(false); }
  };
  return editing ? (
    <span className="row" style={{ gap: 6 }}>
      <input className="inp sm ltr" style={{ width: 120 }} autoFocus inputMode="decimal" value={text} aria-label={t('سعر الخدمة')} disabled={busy} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void save(); if (e.key === 'Escape') setEditing(false); }} />
      <button type="button" className="icon-btn flat" aria-label={t('حفظ')} onClick={() => void save()} disabled={busy}>{busy ? <Spinner /> : <Icon name="check" />}</button>
      <button type="button" className="icon-btn flat" aria-label={t('إلغاء')} onClick={() => setEditing(false)}><Icon name="x" /></button>
    </span>
  ) : (
    <button type="button" className="edit" onClick={() => { setText(link.price === null ? '' : String(link.price)); setEditing(true); }}>
      {link.price === null ? <span className="muted">{t('بلا سعر')}</span> : <span className="num">{money(hasActiveOffer(link) ? link.offerPrice : link.price)}</span>}<Icon name="edit" size="sm" />
    </button>
  );
}

function AddRow({ service, companyId, categoryLabel }: { service: CatalogService; companyId: string; categoryLabel: string }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const add = async () => {
    const value = text.trim() === '' ? null : parseNumber(text);
    if (value !== null && value <= 0) { toast(t('اكتب سعرًا أكبر من صفر، أو اتركه فارغًا.'), 'err'); return; }
    setBusy(true);
    try { await addCompanyService(companyId, service.id, value, ''); toast(t('أُضيفت الخدمة'), 'ok'); }
    catch (e) { toast(e instanceof ServiceError && e.problem === 'exists' ? t('تقدم هذه الخدمة بالفعل.') : t('تعذّرت الإضافة.'), 'err'); }
    finally { setBusy(false); }
  };
  return (
    <div className="lr">
      <div className="grow"><div className="b">{service.name}</div><div className="sub">{categoryLabel}{service.description ? ` · ${service.description}` : ''}</div></div>
      <div className="sfx" style={{ width: 170 }}><input className="inp sm ltr" inputMode="decimal" placeholder={t('السعر (اختياري)')} aria-label={t('سعر {0}', service.name)} value={text} onChange={(e) => setText(e.target.value)} /><span>SDG</span></div>
      <button type="button" className="btn sm p" disabled={busy} onClick={() => void add()}>{busy && <Spinner />}{t('إضافة')}</button>
    </div>
  );
}

function RequestCard({ request: r }: { request: ServiceRequest }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const act = async (status: ServiceRequest['status']) => {
    setBusy(true);
    try {
      const told = await setRequestStatus(r, status);
      toast(told ? t('تم تحديث الطلب وأُبلغ العميل') : t('تم تحديث الطلب، لكن تعذّر إرسال الإشعار'), told ? 'ok' : 'info');
    } catch { toast(t('تعذّر تحديث الطلب.'), 'err'); } finally { setBusy(false); }
  };
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="row"><b className="grow">{r.serviceName}</b><Chip tone={REQUEST_TONE[r.status]}>{REQUEST_LABEL[r.status]}</Chip></div>
      <div className="sub">{r.customerName || t('عميل')} · <span className="num">{r.contactPhone}</span> · {ago(r.createdAt)}</div>
      {r.details && <div style={{ fontSize: 13 }}>{r.details}</div>}
      {r.address && <div className="sub">{r.address}</div>}
      <div className="row">
        {nextRequestStatuses(r.status).map((s) => (
          <button key={s} type="button" disabled={busy} className={`btn sm grow ${s === 'rejected' ? 'd' : 'p'}`} onClick={() => void act(s)}>{ACTION_LABEL[s]}</button>
        ))}
      </div>
    </div>
  );
}

function ServiceDialog({
  companyId, choices, lookupLabel, existing, onClose,
}: {
  companyId: string;
  choices: { id: string; label: string }[];
  lookupLabel: (id: string | null) => string;
  existing: { link?: CompanyService; service?: CatalogService };
  onClose: () => void;
}) {
  const toast = useToast();
  const { link, service } = existing;
  const own = !link || !!service?.ownerCompanyId;
  const [name, setName] = useState(service?.name ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(service?.categoryId ?? null);
  const [price, setPrice] = useState(link?.price === null || link === undefined ? '' : String(link.price));
  const [note, setNote] = useState(link?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const priceNum = price.trim() === '' ? null : parseNumber(price);
  const priceBad = priceNum !== null && priceNum <= 0;
  const valid = (!own || (name.trim().length > 0 && categoryId !== null)) && !priceBad;

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    setError('');
    try {
      if (!link) await createOwnService(companyId, { categoryId: categoryId as string, name, description, price: priceNum, note });
      else {
        if (service?.ownerCompanyId) await updateOwnService(service.id, { categoryId: categoryId as string, name, description });
        if (!link.isActive) await setServiceActive(link, true);
        const fresh = link.isActive ? link : { ...link, offerPrice: null, offerEndsAt: null };
        await updateCompanyService(fresh, priceNum, note);
      }
      toast(t('تم الحفظ'), 'ok');
      onClose();
    } catch (e) {
      setError(e instanceof ServiceError && e.problem === 'price-below-offer' ? t('السعر يجب أن يبقى أعلى من سعر العرض الجاري. أنهِ العرض أولًا.') : e instanceof ServiceError && e.problem === 'category' ? t('تعذّر إنشاء الخدمة: تأكد أن التصنيف فعّال.') : t('تعذّر الحفظ، حاول مرة أخرى.'));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={!link ? t('خدمة جديدة') : service?.name ?? t('تعديل الخدمة')}
      onClose={onClose}
      busy={busy}
      wide
      footer={<><button type="button" className="btn p" disabled={!valid || busy} onClick={() => void save()}>{busy && <Spinner />}{t('حفظ')}</button><button type="button" className="btn" disabled={busy} onClick={onClose}>{t('إلغاء')}</button></>}
    >
      {own && (
        <>
          <div className="fld"><label htmlFor="sv-name">{t('اسم الخدمة')}</label><input id="sv-name" className="inp" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} autoFocus /></div>
          <div className="fld"><label htmlFor="sv-desc">{t('وصف الخدمة')}</label><textarea id="sv-desc" className="inp" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <CategorySelect choices={choices} value={categoryId} currentLabel={lookupLabel(categoryId)} onChange={setCategoryId} />
        </>
      )}
      <div className="fld"><label htmlFor="sv-price">{t('السعر')}{' '}<span className="muted">{t('(اختياري)')}</span></label><div className="sfx"><input id="sv-price" className={`inp ltr${priceBad ? ' err' : ''}`} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /><span>SDG</span></div>{priceBad && <span className="errt">{t('اكتب سعرًا أكبر من صفر، أو اتركه فارغًا.')}</span>}</div>
      <div className="fld"><label htmlFor="sv-note">{t('ملاحظة للعميل')}{' '}<span className="muted">{t('(اختياري)')}</span></label><input id="sv-note" className="inp" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /></div>
      {error && <Banner tone="bad" icon="alert" tight>{error}</Banner>}
    </Modal>
  );
}
