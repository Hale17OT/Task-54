import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { healthCheckApi } from '@/api/health-check.api';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/common/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';
import type { HealthCheckDto } from '@checc/shared/types/health-check.types';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@checc/shared/constants/roles';
import { Plus, AlertTriangle } from 'lucide-react';

export function ReportListPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [reports, setReports] = useState<HealthCheckDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    healthCheckApi.list().then((res) => {
      setReports(res.data);
      setIsLoading(false);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
      setIsLoading(false);
    });
  }, []);

  const isStaff = user?.role === UserRole.STAFF || user?.role === UserRole.ADMIN;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Health Reports</h1>
          <p className="text-muted-foreground">
            {user?.role === UserRole.REVIEWER
              ? 'Reports awaiting your review'
              : 'Health check reports'}
          </p>
        </div>
        {isStaff && (
          <Button onClick={() => navigate('/reports/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Report
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-destructive text-sm">{error}</div>
      )}

      <DataTable
        columns={[
          { header: 'Date', accessor: (row) => formatDateTime(row.createdAt) },
          { header: 'Version', accessor: (row) => `v${row.currentVersion}` },
          {
            header: 'Status',
            accessor: (row) => (
              <div className="flex items-center gap-2">
                <StatusBadge status={row.status} />
                {row.complianceBreach && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    SLA Breach
                  </Badge>
                )}
              </div>
            ),
          },
        ]}
        data={reports}
        isLoading={isLoading}
        emptyMessage="No health reports found"
        onRowClick={(row) => navigate(`/reports/${row.id}`)}
      />
    </div>
  );
}
