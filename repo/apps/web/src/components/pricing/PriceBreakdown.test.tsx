import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PriceBreakdown } from './PriceBreakdown';

describe('PriceBreakdown', () => {
  it('renders subtotal and total without discounts', () => {
    render(<PriceBreakdown subtotal={200} discounts={[]} finalTotal={200} />);
    expect(screen.getByText('Subtotal')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getAllByText('$200.00')).toHaveLength(2);
  });

  it('renders discount lines when present', () => {
    render(
      <PriceBreakdown
        subtotal={200}
        discounts={[
          { ruleName: '10% Off', description: 'Holiday sale', discountAmount: 20 },
        ]}
        finalTotal={180}
      />,
    );
    expect(screen.getByText('10% Off')).toBeInTheDocument();
    expect(screen.getByText('Holiday sale')).toBeInTheDocument();
    // Both the discount line badge and total savings show -$20.00
    expect(screen.getAllByText('-$20.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('$180.00')).toBeInTheDocument();
  });

  it('shows best offer applied header when discounts exist', () => {
    render(
      <PriceBreakdown
        subtotal={100}
        discounts={[{ ruleName: 'Promo', description: 'Test', discountAmount: 10 }]}
        finalTotal={90}
      />,
    );
    expect(screen.getByText('Best Offer Applied')).toBeInTheDocument();
  });

  it('does not show savings section when no discounts', () => {
    render(<PriceBreakdown subtotal={100} discounts={[]} finalTotal={100} />);
    expect(screen.queryByText('Total Savings')).not.toBeInTheDocument();
    expect(screen.queryByText('Best Offer Applied')).not.toBeInTheDocument();
  });

  it('shows total savings when multiple discounts', () => {
    render(
      <PriceBreakdown
        subtotal={300}
        discounts={[
          { ruleName: 'Rule A', description: 'Desc A', discountAmount: 30 },
          { ruleName: 'Rule B', description: 'Desc B', discountAmount: 20 },
        ]}
        finalTotal={250}
      />,
    );
    expect(screen.getByText('Total Savings')).toBeInTheDocument();
    expect(screen.getByText('-$50.00')).toBeInTheDocument();
  });
});
