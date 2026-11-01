import type { ReactNode } from 'react';

/** The centred card of every screen outside the shop: sign-in and account states. */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="login">
      <div className="login-card">
        <div className="brand" style={{ fontSize: 20 }}>
          <span className="brand-mark">س</span>
          سوق السودان للتقنية
        </div>
        <h1 className="auth-title">{title}</h1>
        {subtitle && <p className="auth-sub">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
