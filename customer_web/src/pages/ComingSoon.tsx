import { Link } from 'react-router-dom';

export function ComingSoon({ title }: { title: string }) {
  return (
    <main className="tile" style={{ marginTop: 20, textAlign: 'center', padding: 64 }}>
      <h1 style={{ margin: 0, fontSize: 28 }}>{title}</h1>
      <p style={{ color: 'var(--muted)' }}>هذه الصفحة قيد البناء.</p>
      <Link to="/" className="pill">العودة للرئيسية</Link>
    </main>
  );
}
