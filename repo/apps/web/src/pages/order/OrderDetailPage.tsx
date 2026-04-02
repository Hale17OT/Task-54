import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { orderApi } from '@/api/order.api';
import { paymentApi } from '@/api/payment.api';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@checc/shared/constants/roles';
import type { PaymentDto } from '@checc/shared/types/payment.types';
import { CreditCard, Undo2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { PriceBreakdown } from '@/components/pricing/PriceBreakdown';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { OrderDto } from '@checc/shared/types/order.types';

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [payments, setPayments] = useState<PaymentDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isStaffOrAdmin = user?.role === UserRole.STAFF || user?.role === UserRole.ADMIN;

  useEffect(() => {
    Promise.all([
      orderApi.getById(id!),
      paymentApi.listByOrder(id!).catch(() => ({ data: [] })),
    ]).then(([orderRes, paymentsRes]) => {
      setOrder(orderRes.data);
      setPayments(Array.isArray(paymentsRes.data) ? paymentsRes.data : []);
      setIsLoading(false);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load order');
      setIsLoading(false);
    });
  }, [id]);

  if (isLoading) return <LoadingSpinner className="h-64" text="Loading order..." />;
  if (error) return <div className="rounded-md bg-destructive/10 p-4 text-destructive text-sm">{error}</div>;
  if (!order) return <p className="text-destructive">Order not found</p>;

  const discountLines = order.lines
    .filter((line) => line.discountAmount > 0)
    .flatMap((line) => {
      try {
        const reasoning = line.discountReason ? JSON.parse(line.discountReason) : null;
        if (reasoning?.rulesApplied?.length > 0) {
          return reasoning.rulesApplied.map((rule: { ruleName: string; description?: string; discountAmount: number }) => ({
            ruleName: rule.ruleName,
            description: rule.description || `${rule.ruleName} applied to ${line.serviceName}`,
            discountAmount: rule.discountAmount,
          }));
        }
      } catch { /* not structured JSON */ }
      return [{ ruleName: line.serviceName, description: 'Discount applied', discountAmount: line.discountAmount }];
    });

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Order {order.orderNumber}</h1>
          <p className="text-muted-foreground">Placed {formatDateTime(order.createdAt)}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Order Lines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {order.lines.map((line) => (
              <div key={line.id} className="flex justify-between text-sm">
                <span>{line.serviceName} x{line.quantity}</span>
                <span className="font-medium">{formatCurrency(line.lineTotal)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <PriceBreakdown
        subtotal={order.subtotal}
        discounts={discountLines}
        finalTotal={order.finalTotal}
      />

      {/* Staff/Admin actions */}
      {isStaffOrAdmin && (
        <div className="flex gap-3">
          {order.status === 'PENDING_PAYMENT' && (
            <Button onClick={() => navigate(`/payments/record?orderId=${order.id}&amount=${order.finalTotal}`)}>
              <CreditCard className="mr-2 h-4 w-4" />Record Payment
            </Button>
          )}
          {order.status === 'PAID' && payments.length > 0 && (
            <Button variant="outline" onClick={() => navigate(`/payments/refund?paymentId=${payments[0].id}&amount=${payments[0].amount}`)}>
              <Undo2 className="mr-2 h-4 w-4" />Process Refund
            </Button>
          )}
        </div>
      )}

      {order.autoCancelAt && order.status === 'PENDING_PAYMENT' && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Auto-cancels at {formatDateTime(order.autoCancelAt)}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
