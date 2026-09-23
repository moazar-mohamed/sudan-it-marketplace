import { useAuth } from '../auth/AuthProvider';
import { Card, KeyValue, PageHeader, Text } from '../components/ui';
import { useI18n } from '../i18n/I18nProvider';

export function ProfilePage() {
  const { t } = useI18n();
  const { state, signOut } = useAuth();
  const profile = state.status === 'authorized' ? state.profile : null;

  return (
    <>
      <PageHeader
        title={t('profile.title')}
        subtitle={t('profile.subtitle')}
        back={{ to: '/', label: t('nav.dashboard') }}
      />
      {profile && (
        <Card>
          <div className="hero">
            <span className="userchip__avatar userchip__avatar--lg">
              {(profile.fullName || profile.email || 'A').charAt(0).toUpperCase()}
            </span>
            <div>
              <h2>
                <Text>{profile.fullName || profile.email}</Text>
              </h2>
              <span className="muted">{t('profile.roleValue')}</span>
            </div>
          </div>
          <dl className="kv-list">
            <KeyValue label={t('profile.name')}>
              {profile.fullName ? <Text>{profile.fullName}</Text> : '—'}
            </KeyValue>
            <KeyValue label={t('profile.email')}>
              <bdi dir="ltr">{profile.email || '—'}</bdi>
            </KeyValue>
            <KeyValue label={t('profile.role')}>{t('profile.roleValue')}</KeyValue>
          </dl>
          <div className="card__foot">
            <button className="btn btn--danger-ghost" onClick={() => void signOut()}>
              {t('common.signOut')}
            </button>
          </div>
        </Card>
      )}
    </>
  );
}
