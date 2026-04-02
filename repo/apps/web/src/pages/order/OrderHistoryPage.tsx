import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { orderApi } from '@/api/order.api';
import { DataTable } from '@/components/common/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { OrderDto } from '@checc/shared/types/order.types';

export function OrderHistoryPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    orderApi.list().then((res) => {
      setOrders(res.data);
      setIsLoading(false);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
      setIsLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
        <p className="text-muted-foreground">View your order history</p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-destructive text-sm">{error}</div>
      )}

      <DataTable
        columns={[
          {
            header: 'Order #',
            accessor: 'orderNumber' as keyof OrderDto,
            className: 'font-mono',
          },
          {
            header: 'Date',
            accessor: (row) => formatDateTime(row.createdAt),
          },
          {
            header: 'Items',
            accessor: (row) => `${row.lines.length} item(s)`,
          },
          {
            header: 'Total',
            accessor: (row) => formatCurrency(row.finalTotal),
          },
          {
            header: 'Status',
            accessor: (row) => <StatusBadge status={row.status} />,
          },
        ]}
        data={orders}
        isLoading={isLoading}
        emptyMessage="No orders yet"
        onRowClick={(row) => navigate(`/orders/${row.id}`)}
      />
    </div>
  );
}
