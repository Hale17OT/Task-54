import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tag, Percent } from 'lucide-react';

interface DiscountLine {
  ruleName: string;
  description: string;
  discountAmount: number;
}

interface PriceBreakdownProps {
  subtotal: number;
  discounts: DiscountLine[];
  finalTotal: number;
}

export function PriceBreakdown({ subtotal, discounts, finalTotal }: PriceBreakdownProps) {
  const totalDiscount = discounts.reduce((sum, d) => sum + d.discountAmount, 0);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Subtotal</span>
        <span className="font-medium">{formatCurrency(subtotal)}</span>
      </div>

      {discounts.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Tag className="h-3 w-3" />
              Best Offer Applied
            </p>
            {discounts.map((d, i) => (
              <div key={i} className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Percent className="h-3 w-3 text-green-600 shrink-0" />
                    <span className="text-sm font-medium text-green-700 truncate">
                      {d.ruleName}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground ml-4.5 mt-0.5">
                    {d.description}
                  </p>
                </div>
                <Badge variant="success" className="shrink-0">
                  -{formatCurrency(d.discountAmount)}
                </Badge>
              </div>
            ))}
          </div>
        </>
      )}

      <Separator />

      {totalDiscount > 0 && (
        <div className="flex items-center justify-between text-sm text-green-700">
          <span>Total Savings</span>
          <span className="font-medium">-{formatCurrency(totalDiscount)}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-lg font-bold">Total</span>
        <span className="text-lg font-bold">{formatCurrency(finalTotal)}</span>
      </div>
    </div>
  );
}
