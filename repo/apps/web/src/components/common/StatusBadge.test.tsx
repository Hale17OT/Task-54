import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders patient-friendly label for PENDING_PAYMENT', () => {
    render(<StatusBadge status="PENDING_PAYMENT" />);
    expect(screen.getByText('Payment Due')).toBeInTheDocument();
  });

  it('renders patient-friendly label for SIGNED as Reviewed', () => {
    render(<StatusBadge status="SIGNED" />);
    expect(screen.getByText('Reviewed')).toBeInTheDocument();
  });

  it('renders Draft for DRAFT status', () => {
    render(<StatusBadge status="DRAFT" />);
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it.each([
    ['DRAFT', 'Draft'], ['SUBMITTED', 'Submitted'], ['ACTIVE', 'Active'],
    ['REJECTED', 'Rejected'], ['CANCELED', 'Canceled'],
    ['PENDING_PAYMENT', 'Payment Due'], ['PAID', 'Paid'], ['REFUNDED', 'Refunded'],
    ['AWAITING_REVIEW', 'Awaiting Review'], ['SIGNED', 'Reviewed'], ['AMENDED', 'Amended'],
    ['IN_REVIEW', 'In Review'], ['PUBLISHED', 'Published'], ['ARCHIVED', 'Archived'],
    ['OPEN', 'Open'], ['INVESTIGATING', 'Investigating'], ['RESOLVED', 'Resolved'], ['DISMISSED', 'Dismissed'],
  ])('renders %s as "%s"', (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('handles unknown status gracefully with underscore replacement', () => {
    render(<StatusBadge status="UNKNOWN_STATUS" />);
    expect(screen.getByText('UNKNOWN STATUS')).toBeInTheDocument();
  });
});
