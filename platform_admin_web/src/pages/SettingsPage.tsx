import { NoticesSection } from '../components/NoticesCard';
import { PageHeader } from '../components/ui';
import { useI18n } from '../i18n/I18nProvider';

export function SettingsPage() {
  const { t } = useI18n();
  // The language and the appearance live in the person menu (top bar), so this page keeps to the notices.
  return (
    <>
      <PageHeader
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
        back={{ to: '/', label: t('nav.dashboard') }}
      />
      <NoticesSection />
    </>
  );
}
