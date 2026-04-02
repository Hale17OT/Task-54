import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { paymentApi } from '@/api/payment.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefundReasonCode } from '@checc/shared/types/payment.types';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency } from '@/lib/utils';
import { Loader2, AlertCircle, Undo2, CheckCircle } from 'lucide-react';

export function RefundPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const paymentId = searchParams.get('paymentId') || '';
  const maxAmount = searchParams.get('amount') || '';

  const [amount, setAmount] = useState(maxAmount);
  const [reasonCode, setReasonCode] = useState<string>(RefundReasonCode.PATIENT_REQUEST);
  const [reasonDetail, setReasonDetail] = useState('');
  const [supervisorUsername, setSupervisorUsername] = useState('');
  const [supervisorPassword, setSupervisorPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const needsSupervisor = !user?.canApproveRefunds;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (!paymentId) { setError('Payment ID is required'); return; }
    if (isNaN(parsedAmount) || parsedAmount <= 0) { setError('Refund amount must be a positive number'); return; }
    if (maxAmount && parsedAmount > parseFloat(maxAmount)) { setError(`Refund amount cannot exceed original payment ($${maxAmount})`); return; }
    if (needsSupervisor && (!supervisorUsername || !supervisorPassword)) { setError('Supervisor credentials are required for approval'); return; }

    setIsSubmitting(true);
    try {
      await paymentApi.refund({
        paymentId,
        amount: parsedAmount,
        reasonCode,
        reasonDetail: reasonDetail || undefined,
        supervisorUsername: needsSupervisor ? supervisorUsername : undefined,
        supervisorPassword: needsSupervisor ? supervisorPassword : undefined,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refund failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <Card className="border-green-300 bg-green-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-green-800">
              <CheckCircle className="h-5 w-5" />Refund Processed
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>Refund of {formatCurrency(parseFloat(amount))} has been processed.</p>
          </CardContent>
        </Card>
        <Button onClick={() => navigate('/payments/history')} className="w-full">View Payment History</Button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Process Refund</h1>
        <p className="text-muted-foreground">Refund a recorded payment with reason and supervisor approval</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Undo2 className="h-5 w-5" />Refund Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="paymentId">Payment ID</Label>
              <Input id="paymentId" value={paymentId} readOnly className="bg-muted font-mono text-xs" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Refund Amount</Label>
              <Input id="amount" type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reasonCode">Reason Code</Label>
              <select id="reasonCode" value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {Object.values(RefundReasonCode).map((code) => (
                  <option key={code} value={code}>{code.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reasonDetail">Details (optional)</Label>
              <textarea id="reasonDetail" value={reasonDetail} onChange={(e) => setReasonDetail(e.target.value)} className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Additional context..." />
            </div>

            {needsSupervisor && (
              <Card className="border-yellow-300 bg-yellow-50">
                <CardContent className="pt-4 space-y-3">
                  <p className="text-sm font-medium text-yellow-800">Supervisor approval required</p>
                  <div className="space-y-2">
                    <Label htmlFor="supUser">Supervisor Username</Label>
                    <Input id="supUser" value={supervisorUsername} onChange={(e) => setSupervisorUsername(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supPass">Supervisor Password</Label>
                    <Input id="supPass" type="password" value={supervisorPassword} onChange={(e) => setSupervisorPassword(e.target.value)} required />
                  </div>
                </CardContent>
              </Card>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting || !paymentId || !amount || !reasonCode}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Undo2 className="mr-2 h-4 w-4" />}
              Process Refund
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
