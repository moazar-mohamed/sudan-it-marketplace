import { APP_TEXT, textFor, type Announcement, type Lang, type Notice, type RequiredUpdate } from '../data/platformSettings';
import { useI18n } from '../i18n/I18nProvider';
import { Icon, type IconName } from './Icon';

/*
 * How a notice will look on the phone, before it is saved: the same text rule
 * the apps use (the reader's language, else the other), in both languages.
 */

const LANGS: Lang[] = ['ar', 'en'];
const KIND_ICON: Record<Announcement['kind'], IconName> = { info: 'info', warning: 'alert', success: 'check' };

const label = (lang: Lang, link: Notice['link']) => textFor(lang, link.labelAr, link.labelEn);

function Frame({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return (
    <div className="phone" dir={lang === 'ar' ? 'rtl' : 'ltr'} lang={lang}>
      <span className="phone__lang">{lang === 'ar' ? 'العربية' : 'English'}</span>
      {children}
    </div>
  );
}

/** The banner at the top of the app, once per language. */
export function AnnouncementPreview({ announcement }: { announcement: Announcement }) {
  const { t } = useI18n();
  return (
    <div className="previews" aria-label={t('notices.preview')}>
      {LANGS.map((lang) => {
        const message = textFor(lang, announcement.messageAr, announcement.messageEn);
        const action = label(lang, announcement.link);
        return (
          <Frame key={lang} lang={lang}>
            {message ? (
              <div className={`preview-banner preview-banner--${announcement.kind}`}>
                <Icon name={KIND_ICON[announcement.kind]} size={18} />
                <div className="preview-banner__body">
                  <span>{message}</span>
                  {announcement.link.url.trim() && action && <span className="preview-banner__action">{action}</span>}
                </div>
                <span className="preview-banner__close" aria-label={APP_TEXT[lang].dismiss}>
                  ×
                </span>
              </div>
            ) : (
              <p className="muted preview__empty">{t('notices.preview.empty')}</p>
            )}
          </Frame>
        );
      })}
    </div>
  );
}

/** The screen that covers the app, once per language, with the expected time back and the button. */
export function MaintenancePreview({ notice }: { notice: Notice }) {
  const { t } = useI18n();
  return (
    <div className="previews" aria-label={t('notices.preview')}>
      {LANGS.map((lang) => {
        const message = textFor(lang, notice.messageAr, notice.messageEn);
        const action = label(lang, notice.link);
        const time = notice.endsAt
          ? new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en', { dateStyle: 'medium', timeStyle: 'short' }).format(notice.endsAt)
          : null;
        return (
          <Frame key={lang} lang={lang}>
            <div className="preview-screen">
              <Icon name="services" size={40} />
              <strong>{APP_TEXT[lang].maintenanceTitle}</strong>
              {message ? <p>{message}</p> : <p className="muted">{t('notices.preview.empty')}</p>}
              {/* Like the app: the expected time back replaces "try again in a little while". */}
              {time ? (
                <p className="preview-screen__back">{APP_TEXT[lang].backAt.replace('{time}', time)}</p>
              ) : (
                <p className="muted">{APP_TEXT[lang].tryLater}</p>
              )}
              {notice.link.url.trim() && action && <span className="preview-screen__button">{action}</span>}
            </div>
          </Frame>
        );
      })}
    </div>
  );
}

/** The screen an out-of-date app is stopped on. */
export function UpdatePreview({ update }: { update: RequiredUpdate }) {
  const { t } = useI18n();
  return (
    <div className="previews" aria-label={t('notices.preview')}>
      {LANGS.map((lang) => (
        <Frame key={lang} lang={lang}>
          <div className="preview-screen">
            <Icon name="products" size={40} />
            <strong>{APP_TEXT[lang].updateTitle}</strong>
            <p>{textFor(lang, update.messageAr, update.messageEn) ?? APP_TEXT[lang].updateBody}</p>
            <span className="preview-screen__button">{APP_TEXT[lang].updateButton}</span>
          </div>
        </Frame>
      ))}
    </div>
  );
}
