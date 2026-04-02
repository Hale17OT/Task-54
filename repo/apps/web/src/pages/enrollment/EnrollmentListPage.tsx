import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { enrollmentApi } from '@/api/enrollment.api';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@checc/shared/constants/roles';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/common/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { EnrollmentDto } from '@checc/shared/types/enrollment.types';
import { formatDate } from '@/lib/utils';
import { Plus } from 'lucide-react';

export function EnrollmentListPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isPatient = user?.role === UserRole.PATIENT;
  const [enrollments, setEnrollments] = useState<EnrollmentDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    enrollmentApi.list().then((res) => {
      setEnrollments(res.data);
      setIsLoading(false);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load enrollments');
      setIsLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Enrollments</h1>
          <p className="text-muted-foreground">Manage your enrollment applications</p>
        </div>
        {isPatient && (
          <Button onClick={() => navigate('/enrollments/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Enrollment
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-destructive text-sm">{error}</div>
      )}

      <DataTable
        columns={[
          {
            header: 'Date',
            accessor: (row) => formatDate(row.createdAt),
          },
          {
            header: 'Services',
            accessor: (row) => `${row.serviceLines.length} service(s)`,
          },
          {
            header: 'Status',
            accessor: (row) => <StatusBadge status={row.status} />,
          },
          {
            header: 'Notes',
            accessor: (row) => (
              <span className="truncate max-w-xs block">{row.notes || '—'}</span>
            ),
          },
        ]}
        data={enrollments}
        isLoading={isLoading}
        emptyMessage="No enrollments yet. Create your first enrollment to get started."
        onRowClick={(row) => navigate(`/enrollments/${row.id}`)}
      />
    </div>
  );
}
