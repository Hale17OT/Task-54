import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { enrollmentApi } from '@/api/enrollment.api';
import { orderApi } from '@/api/order.api';
import { pricingApi } from '@/api/pricing.api';
import { syncQueue } from '@/utils/sync-queue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { PriceBreakdown } from '@/components/pricing/PriceBreakdown';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { EnrollmentDto } from '@checc/shared/types/enrollment.types';
import type { OrderDto } from '@checc/shared/types/order.types';
import { EnrollmentStatus } from '@checc/shared/types/enrollment.types';
import { Edit, Send, X, Loader2 } from 'lucide-react';

export function EnrollmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [enrollment, setEnrollment] = useState<EnrollmentDto | null>(null);
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [pricingPreview, setPricingPreview] = useState<{
    lines: Array<{ discountAmount: number; finalPrice: number; reasoning: { rulesApplied: Array<{ ruleName: string; description?: string; discountAmount: number }> } }>;
    totalDiscount: number;
    totalFinal: number;
  } | null>(null);
  const [isComputingPrice, setIsComputingPrice] = useState(false);

  useEffect(() => {
    enrollmentApi.getById(id!).then((res) => {
      setEnrollment(res.data);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, [id]);

  // Load order data directly by enrollment ID
  useEffect(() => {
    if (!enrollment || enrollment.status === EnrollmentStatus.DRAFT) return;
    orderApi.getByEnrollmentId(enrollment.id).then((res) => {
      if (res.data) setOrder(res.data);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load order details');
    });
  }, [enrollment]);

  const handleCheckoutPreview = async () => {
    setIsComputingPrice(true);
    setError(null);
    try {
      const lines = enrollment!.serviceLines.map((sl) => ({
        serviceId: sl.serviceId,
        category: sl.service?.category || '',
        unitPrice: sl.service?.basePrice || 0,
        quantity: sl.quantity,
      }));
      const res = await pricingApi.compute(lines);
      setPricingPreview(res.data as any);
      setShowCheckout(true);
    } catch {
      // Pricing failed — show error, do NOT open checkout without transparency
      setError('Unable to compute pricing. Please try again or contact staff.');
    } finally {
      setIsComputingPrice(false);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await enrollmentApi.submit(id!);
      setEnrollment(res.data);
      setShowCheckout(false);
    } catch (err) {
      await syncQueue.enqueue(`submit-${id}-${Date.now()}`, {
        type: 'submit-enrollment',
        payload: { enrollmentId: id! },
      });
      setError(
        (err instanceof Error ? err.message : 'Submit failed') +
        ' — Queued for sync when you reconnect.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    try {
      const res = await enrollmentApi.cancel(id!);
      setEnrollment(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed');
    }
  };

  if (isLoading) return <LoadingSpinner className="h-64" text="Loading enrollment..." />;
  if (!enrollment) return <p className="text-destructive">Enrollment not found</p>;

  const subtotal = enrollment.serviceLines.reduce(
    (sum, sl) => sum + (sl.service?.basePrice || 0) * sl.quantity,
    0,
  );

  // Build discount lines from order data with structured reasoning
  const discountLines = order?.lines
    ?.filter((line) => line.discountAmount > 0)
    .flatMap((line) => {
      try {
        const reasoning = line.discountReason ? JSON.parse(line.discountReason) : null;
        if (reasoning?.rulesApplied?.length > 0) {
          return reasoning.rulesApplied.map((rule: { ruleName: string; description?: string; discountAmount: number }) => ({
            ruleName: rule.ruleName,
            description: rule.description || `${rule.ruleName} applied`,
            discountAmount: rule.discountAmount,
          }));
        }
      } catch { /* not structured JSON */ }
      return [{ ruleName: 'Discount', description: 'Best-offer applied', discountAmount: line.discountAmount }];
    }) || [];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Enrollment Details</h1>
          <p className="text-muted-foreground">Created {formatDateTime(enrollment.createdAt)}</p>
        </div>
        <StatusBadge status={enrollment.status} />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Services</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {enrollment.serviceLines.map((sl) => (
              <div key={sl.id} className="flex justify-between text-sm">
                <span>
                  {sl.service?.name || sl.serviceId} x{sl.quantity}
                </span>
                <span className="font-medium">
                  {formatCurrency((sl.service?.basePrice || 0) * sl.quantity)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Show full price breakdown with discounts when order exists */}
      {order ? (
        <PriceBreakdown
          subtotal={order.subtotal}
          discounts={discountLines}
          finalTotal={order.finalTotal}
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between font-bold">
              <span>Estimated Total</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {enrollment.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{enrollment.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Checkout pricing preview */}
      {showCheckout && enrollment.status === EnrollmentStatus.DRAFT && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Checkout — Best Offer Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pricingPreview && (
              <PriceBreakdown
                subtotal={subtotal}
                discounts={pricingPreview.lines.flatMap((line) =>
                  line.reasoning.rulesApplied.map((rule) => ({
                    ruleName: rule.ruleName,
                    description: rule.description || `${rule.ruleName} applied`,
                    discountAmount: rule.discountAmount,
                  })),
                )}
                finalTotal={subtotal - pricingPreview.totalDiscount}
              />
            )}
            <div className="flex gap-3 pt-2">
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Confirm & Submit
              </Button>
              <Button variant="outline" onClick={() => setShowCheckout(false)}>Back</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {enrollment.status === EnrollmentStatus.DRAFT && !showCheckout && (
        <div className="flex gap-3">
          <Button onClick={() => navigate(`/enrollments/${id}/edit`)}>
            <Edit className="mr-2 h-4 w-4" />Edit
          </Button>
          <Button onClick={handleCheckoutPreview} disabled={isComputingPrice}>
            {isComputingPrice ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Submit Enrollment
          </Button>
          <Button variant="destructive" onClick={handleCancel}>
            <X className="mr-2 h-4 w-4" />Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
