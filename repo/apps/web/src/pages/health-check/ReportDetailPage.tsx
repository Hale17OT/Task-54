import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/common/StatusBadge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { formatDateTime } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@checc/shared/constants/roles';
import { HealthCheckStatus } from '@checc/shared/types/health-check.types';
import { Send, PenLine, Download, AlertTriangle, Edit } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useReportDetail } from '@/hooks/useReportDetail';

export function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const {
    report, versions, isLoading, error,
    signUsername, setSignUsername, signPassword, setSignPassword, isSigning, sign: handleSign,
    isSubmitting, submitForReview: handleSubmitForReview,
    showEditForm, setShowEditForm, editItems, setEditItems, changeSummary, setChangeSummary, isSavingEdit, startEdit, saveEdit,
    downloadPdf: handleDownloadPdf,
  } = useReportDetail(id!);

  if (isLoading) return <LoadingSpinner className="h-64" text="Loading report..." />;
  if (error && !report) return <div className="rounded-md bg-destructive/10 p-4 text-destructive text-sm">{error}</div>;
  if (!report) return <p className="text-destructive">Report not found</p>;

  const currentVersion = versions.find((v) => v.versionNumber === report.currentVersion);
  const isReviewer = user?.role === UserRole.REVIEWER;
  const isStaff = user?.role === UserRole.STAFF || user?.role === UserRole.ADMIN;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Health Check Report</h1>
          <p className="text-muted-foreground">Version {report.currentVersion} - {formatDateTime(report.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={report.status} />
          {report.complianceBreach && (
            <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />SLA Breach</Badge>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {/* Result Items */}
      {currentVersion && currentVersion.resultItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Test</th>
                    <th className="pb-2 font-medium">Value</th>
                    <th className="pb-2 font-medium">Unit</th>
                    <th className="pb-2 font-medium">Reference</th>
                    <th className="pb-2 font-medium">Flag</th>
                    <th className="pb-2 font-medium">Prior</th>
                  </tr>
                </thead>
                <tbody>
                  {currentVersion.resultItems.map((item) => (
                    <tr key={item.id} className={`border-b ${item.isAbnormal ? 'bg-destructive/5' : ''}`}>
                      <td className="py-2">{item.testName}</td>
                      <td className="py-2 font-mono">{item.value}</td>
                      <td className="py-2 text-muted-foreground">{item.unit}</td>
                      <td className="py-2 text-muted-foreground">
                        {item.referenceLow !== null && item.referenceHigh !== null
                          ? `${item.referenceLow} - ${item.referenceHigh}`
                          : '—'}
                      </td>
                      <td className="py-2">
                        {item.flag && (
                          <Badge variant={item.flag === 'HH' || item.flag === 'LL' ? 'destructive' : 'warning'}>
                            {item.flag}
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {item.priorValue ? `${item.priorValue} (${item.priorDate ? formatDateTime(item.priorDate) : ''})` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Version History */}
      {versions.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Version History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between text-sm border-b pb-2">
                  <div>
                    <span className="font-medium">v{v.versionNumber}</span>
                    <span className="text-muted-foreground ml-2">{formatDateTime(v.createdAt)}</span>
                    {v.changeSummary && <span className="text-muted-foreground ml-2">— {v.changeSummary}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={v.status} />
                    {v.status === HealthCheckStatus.SIGNED && (
                      <Button variant="ghost" size="sm" onClick={() => handleDownloadPdf(v.versionNumber)}>
                        <Download className="h-3 w-3 mr-1" />PDF
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-4">
        {/* Staff: Submit for review */}
        {isStaff && report.status === HealthCheckStatus.DRAFT && (
          <Button onClick={handleSubmitForReview} disabled={isSubmitting}>
            <Send className="mr-2 h-4 w-4" />
            {isSubmitting ? 'Submitting...' : 'Submit for Review'}
          </Button>
        )}

        {/* Reviewer: Sign */}
        {isReviewer && report.status === HealthCheckStatus.AWAITING_REVIEW && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <PenLine className="h-5 w-5" />
                Sign Report
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Re-enter your credentials to sign this report.</p>
              <div className="grid gap-3 max-w-sm">
                <div>
                  <Label htmlFor="sign-username">Username</Label>
                  <Input id="sign-username" value={signUsername} onChange={(e) => setSignUsername(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="sign-password">Password</Label>
                  <Input id="sign-password" type="password" value={signPassword} onChange={(e) => setSignPassword(e.target.value)} />
                </div>
              </div>
              <Button onClick={handleSign} disabled={isSigning || !signUsername || !signPassword}>
                <PenLine className="mr-2 h-4 w-4" />
                {isSigning ? 'Signing...' : 'Sign Report'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Staff: Edit report (creates new version) */}
        {isStaff && (report.status === HealthCheckStatus.DRAFT || report.status === HealthCheckStatus.SIGNED || report.status === HealthCheckStatus.AMENDED) && !showEditForm && (
          <Button variant="outline" onClick={() => startEdit(currentVersion)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Report (New Version)
          </Button>
        )}

        {/* Edit form — creates a new version */}
        {showEditForm && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Edit Report — Creates Version {report.currentVersion + 1}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {report.status === HealthCheckStatus.SIGNED
                  ? 'This report is signed. Editing will create an AMENDED version. The signed version remains locked.'
                  : 'Editing will create a new draft version.'}
              </p>
              <div className="space-y-2">
                {editItems.map((item, i) => (
                  <div key={i} className="grid grid-cols-6 gap-2 items-end text-sm">
                    <div><Label className="text-xs">Test</Label><Input value={item.testName} readOnly className="h-8 bg-muted" /></div>
                    <div><Label className="text-xs">Code</Label><Input value={item.testCode} readOnly className="h-8 bg-muted" /></div>
                    <div><Label className="text-xs">Value</Label><Input value={item.value} onChange={(e) => { const items = [...editItems]; items[i] = { ...items[i], value: e.target.value }; setEditItems(items); }} className="h-8" /></div>
                    <div><Label className="text-xs">Unit</Label><Input value={item.unit} readOnly className="h-8 bg-muted" /></div>
                    <div><Label className="text-xs">Ref Low</Label><Input value={item.referenceLow || ''} readOnly className="h-8 bg-muted" /></div>
                    <div><Label className="text-xs">Ref High</Label><Input value={item.referenceHigh || ''} readOnly className="h-8 bg-muted" /></div>
                  </div>
                ))}
              </div>
              <div>
                <Label htmlFor="changeSummary">Change Summary</Label>
                <Input id="changeSummary" value={changeSummary} onChange={(e) => setChangeSummary(e.target.value)} placeholder="Describe what changed" />
              </div>
              <div className="flex gap-3">
                <Button onClick={saveEdit} disabled={isSavingEdit}>
                  {isSavingEdit ? 'Saving...' : 'Save New Version'}
                </Button>
                <Button variant="outline" onClick={() => setShowEditForm(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* PDF download for signed reports */}
        {report.status === HealthCheckStatus.SIGNED && (
          <Button variant="outline" onClick={() => handleDownloadPdf(report.currentVersion)}>
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        )}
      </div>
    </div>
  );
}
