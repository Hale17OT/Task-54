import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataTable } from './DataTable';

interface TestRow {
  id: string;
  name: string;
  value: number;
}

const columns = [
  { header: 'Name', accessor: 'name' as keyof TestRow },
  { header: 'Value', accessor: (row: TestRow) => `$${row.value}` },
];

const data: TestRow[] = [
  { id: '1', name: 'Item A', value: 100 },
  { id: '2', name: 'Item B', value: 200 },
];

describe('DataTable', () => {
  it('renders column headers', () => {
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
  });

  it('renders data rows', () => {
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText('Item A')).toBeInTheDocument();
    expect(screen.getByText('Item B')).toBeInTheDocument();
    expect(screen.getByText('$100')).toBeInTheDocument();
    expect(screen.getByText('$200')).toBeInTheDocument();
  });

  it('shows loading skeletons when isLoading', () => {
    const { container } = render(<DataTable columns={columns} data={[]} isLoading />);
    // Should not render table headers when loading
    expect(screen.queryByText('Name')).not.toBeInTheDocument();
    // Should render skeleton placeholder divs
    expect(container.querySelectorAll('div').length).toBeGreaterThan(0);
  });

  it('shows empty message when data is empty', () => {
    render(<DataTable columns={columns} data={[]} emptyMessage="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('shows default empty message', () => {
    render(<DataTable columns={columns} data={[]} />);
    expect(screen.getByText('No data found')).toBeInTheDocument();
  });

  it('calls onRowClick when row is clicked', () => {
    const onClick = vi.fn();
    render(<DataTable columns={columns} data={data} onRowClick={onClick} />);
    fireEvent.click(screen.getByText('Item A'));
    expect(onClick).toHaveBeenCalledWith(data[0]);
  });

  it('does not call onRowClick when not provided', () => {
    render(<DataTable columns={columns} data={data} />);
    // Should not throw
    fireEvent.click(screen.getByText('Item A'));
  });
});
