import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { LanguageSwitch } from './LanguageSwitch';
import { t } from '../i18n';

/**
 * The centred card of every screen outside the shop: sign-in and account states.
 * [back]: on a sign-in page, the shop page a visitor can go back to without an account.
 */
export function AuthCard({ title, subtitle, back, children }: { title: string; subtitle?: string; back?: string; children: ReactNode }) {
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
        {!user && back !== undefined && (
          <p className="auth-foot"><Link to={back} className="auth-link">{t('العودة إلى المتجر')}</Link></p>
        )}
        {!user && <LanguageSwitch />}
      </div>
    </div>
  );
}
