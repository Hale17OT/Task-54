import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { paymentApi } from '@/api/payment.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PaymentMethod } from '@checc/shared/types/payment.types';
import type { PaymentDto } from '@checc/shared/types/payment.types';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Loader2, CreditCard, AlertCircle, CheckCircle } from 'lucide-react';

export function PaymentRecordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get('orderId') || '';
  const amount = searchParams.get('amount') || '';

  const [method, setMethod] = useState<string>(PaymentMethod.CASH);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentAmount, setPaymentAmount] = useState(amount);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<PaymentDto | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(paymentAmount);
    if (!orderId) { setError('Order ID is required'); return; }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(orderId)) { setError('Order ID must be a valid UUID format'); return; }
    if (isNaN(parsedAmount) || parsedAmount <= 0) { setError('Amount must be a positive number'); return; }
    if (parsedAmount > 100000) { setError('Amount exceeds maximum allowed ($100,000)'); return; }

    setIsSubmitting(true);
    try {
      const res = await paymentApi.record({
        orderId,
        paymentMethod: method,
        amount: parsedAmount,
        referenceNumber: referenceNumber || undefined,
      });
      setConfirmation(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment recording failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (confirmation) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <Card className="border-green-300 bg-green-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-green-800">
              <CheckCircle className="h-5 w-5" />
              Payment Recorded Successfully
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Payment ID</span><span className="font-mono">{confirmation.id}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-semibold">{formatCurrency(confirmation.amount)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Method</span><span>{confirmation.paymentMethod.replace('_', ' ').toUpperCase()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="text-green-700 font-medium">{confirmation.status}</span></div>
            {confirmation.paidAt && <div className="flex justify-between"><span className="text-muted-foreground">Paid At</span><span>{formatDateTime(confirmation.paidAt)}</span></div>}
          </CardContent>
        </Card>
        <Button onClick={() => navigate('/payments/history')} className="w-full">
          View Payment History
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Record Payment</h1>
        <p className="text-muted-foreground">Register an offline payment</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orderId">Order ID</Label>
              <Input id="orderId" value={orderId} readOnly className="bg-muted" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="method">Payment Method</Label>
              <select
                id="method"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value={PaymentMethod.CASH}>Cash</option>
                <option value={PaymentMethod.CHECK}>Check</option>
                <option value={PaymentMethod.MANUAL_CARD}>Manual Card Terminal</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference">Reference Number</Label>
              <Input
                id="reference"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="Check number, receipt ID, etc."
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting || !orderId}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              Record Payment
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
