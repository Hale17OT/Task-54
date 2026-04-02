import { useEffect, useState } from 'react';
import { paymentApi } from '@/api/payment.api';
import { DataTable } from '@/components/common/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { PaymentDto } from '@checc/shared/types/payment.types';

export function PaymentHistoryPage() {
  const [payments, setPayments] = useState<PaymentDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    paymentApi.list().then((res) => {
      setPayments(res.data);
      setIsLoading(false);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load payments');
      setIsLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payment History</h1>
        <p className="text-muted-foreground">View all recorded payments</p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-destructive text-sm">{error}</div>
      )}

      <DataTable
        columns={[
          { header: 'Date', accessor: (row) => formatDateTime(row.createdAt) },
          { header: 'Method', accessor: (row) => row.paymentMethod.replace('_', ' ').toUpperCase() },
          { header: 'Amount', accessor: (row) => formatCurrency(row.amount) },
          { header: 'Reference', accessor: (row) => row.referenceNumber || '—' },
          { header: 'Status', accessor: (row) => <StatusBadge status={row.status} /> },
        ]}
        data={payments}
        isLoading={isLoading}
        emptyMessage="No payments recorded yet"
      />
    </div>
  );
}
