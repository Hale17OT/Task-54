import { Badge } from '@/components/ui/badge';

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'> = {
  DRAFT: 'secondary',
  SUBMITTED: 'default',
  ACTIVE: 'success',
  REJECTED: 'destructive',
  CANCELED: 'destructive',
  PENDING_PAYMENT: 'warning',
  PAID: 'success',
  REFUNDED: 'outline',
  AWAITING_REVIEW: 'warning',
  SIGNED: 'success',
  AMENDED: 'default',
  IN_REVIEW: 'warning',
  PUBLISHED: 'success',
  ARCHIVED: 'secondary',
  OPEN: 'destructive',
  INVESTIGATING: 'warning',
  RESOLVED: 'success',
  DISMISSED: 'secondary',
};

/** Patient-friendly display labels for statuses */
const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  ACTIVE: 'Active',
  REJECTED: 'Rejected',
  CANCELED: 'Canceled',
  PENDING_PAYMENT: 'Payment Due',
  PAID: 'Paid',
  REFUNDED: 'Refunded',
  AWAITING_REVIEW: 'Awaiting Review',
  SIGNED: 'Reviewed',
  AMENDED: 'Amended',
  IN_REVIEW: 'In Review',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
  OPEN: 'Open',
  INVESTIGATING: 'Investigating',
  RESOLVED: 'Resolved',
  DISMISSED: 'Dismissed',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = statusColors[status] || 'outline';
  const label = statusLabels[status] || status.replace(/_/g, ' ');
  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}
