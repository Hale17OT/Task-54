import { describe, it, expect } from 'vitest';
import { cn, formatCurrency, formatDate, formatDateTime } from './utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
  });

  it('deduplicates tailwind classes', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });
});

describe('formatCurrency', () => {
  it('formats USD currency', () => {
    expect(formatCurrency(100)).toBe('$100.00');
  });

  it('formats with commas for thousands', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('formats negative amounts', () => {
    expect(formatCurrency(-50)).toBe('-$50.00');
  });
});

describe('formatDate', () => {
  it('formats an ISO date string', () => {
    const result = formatDate('2026-03-15T10:30:00Z');
    expect(result).toContain('Mar');
    expect(result).toContain('15');
    expect(result).toContain('2026');
  });
});

describe('formatDateTime', () => {
  it('formats an ISO datetime string with time', () => {
    const result = formatDateTime('2026-03-15T14:30:00Z');
    expect(result).toContain('Mar');
    expect(result).toContain('15');
    expect(result).toContain('2026');
  });
});
