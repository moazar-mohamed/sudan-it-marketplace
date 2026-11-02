import type { ReactNode } from 'react';
import { useAuth } from '../auth';
import { LanguageSwitch } from './LanguageSwitch';
import { t } from '../i18n';

/** The centred card of every screen outside the shop: sign-in and account states. */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { user } = useAuth();
  return (
    <div className="login">
      <div className="login-card">
        <div className="brand" style={{ fontSize: 20 }}>
          <span className="brand-mark">{t('س')}</span>
          {t('سوق السودان للتقنية')}
        </div>
        <h1 className="auth-title">{title}</h1>
        {subtitle && <p className="auth-sub">{subtitle}</p>}
        {children}
        {!user && <LanguageSwitch />}
      </div>
    </div>
  );
}
