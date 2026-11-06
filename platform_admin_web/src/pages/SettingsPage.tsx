import { useAuth } from '../auth/AuthProvider';
import { NoticesSection } from '../components/NoticesCard';
import { PushSettings } from '../components/PushSettings';
import { PageHeader } from '../components/ui';
import { useI18n } from '../i18n/I18nProvider';

export function SettingsPage() {
  const { t } = useI18n();
  const { state } = useAuth();
  const uid = state.status === 'authorized' ? state.profile.uid : null;
  // The language and the appearance live in the person menu (top bar); this page keeps
  // to this browser's notifications and the notices shown in the apps.
  return (
    <>
      <PageHeader
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
        back={{ to: '/', label: t('nav.dashboard') }}
      />
      {uid && <PushSettings uid={uid} />}
      <NoticesSection />
    </>
  );
}
