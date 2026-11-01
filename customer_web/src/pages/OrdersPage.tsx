import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, Skeleton } from '../components/Bits';
import { useCatalog } from '../data/DataProvider';
import { formatPrice } from '../data/format';
import { useMyOrders } from '../data/hooks';
import { isAwaitingVerification, ORDER_STATUS, shortOrderId } from '../data/orders';

type Filter = 'all' | 'active' | 'done';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'active', label: 'جارية' },
  { value: 'done', label: 'منتهية' },
];

export function OrdersPage() {
  const { profile } = useCatalog();
  const { items, error } = useMyOrders(profile.id);
  const [filter, setFilter] = useState<Filter>('all');

  const shown = (items ?? []).filter((o) => {
    if (filter === 'all') return true;
    const finished = o.orderStatus === 'completed' || o.orderStatus === 'cancelled';
    return filter === 'done' ? finished : !finished;
  });

  return (
    <main className="stack narrow">
      <h1 className="page-title">طلباتي</h1>
      {error ? (
        <ErrorState />
      ) : items === null ? (
        <Skeleton height={240} />
      ) : items.length === 0 ? (
        <EmptyState title="لا توجد طلبات بعد" message="عند شرائك أجهزة أو منتجات تقنية من السوق، ستظهر طلباتك وحالتها المباشرة هنا.">
          <Link to="/browse" className="pill">تصفح المنتجات</Link>
        </EmptyState>
      ) : (
        <>
          <div className="chips">
            {FILTERS.map((f) => (
              <button key={f.value} className={`chip-link${filter === f.value ? ' on' : ''}`} onClick={() => setFilter(f.value)}>{f.label}</button>
            ))}
          </div>
          {shown.length === 0 && <EmptyState title="لا طلبات هنا." />}
          {shown.map((order) => {
            const status = ORDER_STATUS[order.orderStatus];
            return (
              <Link key={order.id} to={`/orders/${order.id}`} className="tile order-card">
                <header>
                  <strong className="grow">طلب #<span dir="ltr">{shortOrderId(order.id)}</span></strong>
                  <span className={`status ${status.tone}`}>{status.label}</span>
                </header>
                <div className="pname">{order.productName}</div>
                <div className="pmeta">{order.companyName}</div>
                {isAwaitingVerification(order) && <div className="await">بانتظار تأكيد الشركة لدفعك</div>}
                <div className="prow">
                  <span className="pmeta">المبلغ الإجمالي</span>
                  <span className="price">{formatPrice(order.totalAmount)}</span>
                </div>
              </Link>
            );
          })}
        </>
      )}
    </main>
  );
}
