import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable } from '@/components/common/DataTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';
import type { RiskEventDto, IpRuleDto } from '@checc/shared/types/risk.types';
import { Separator } from '@/components/ui/separator';
import { Shield, AlertTriangle, FileWarning, Plus, Trash2, CheckCircle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useRiskDashboard } from '@/hooks/useRiskDashboard';

/** Allowlisted hit-log keys safe for admin display. */
const safeHitLogKeys = new Set([
  'promoCount', 'discountApplications', 'registrationCount', 'refundCount',
  'window', 'ip', 'count', 'severity', 'eventType', 'threshold',
]);

const severityColors: Record<string, 'secondary' | 'warning' | 'destructive' | 'default'> = {
  low: 'secondary', medium: 'warning', high: 'destructive', critical: 'destructive',
};

export function RiskDashboardPage() {
  const {
    events, incidents, ipRules, isLoading, error,
    expandedIncident, setExpandedIncident,
    showIpForm, setShowIpForm, newIp, setNewIp, newRuleType, setNewRuleType, newReason, setNewReason,
    createIpRule: handleCreateIpRule, deleteIpRule: handleDeleteIpRule, updateIncident: handleUpdateIncident,
  } = useRiskDashboard();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Risk Dashboard</h1>
        <p className="text-muted-foreground">Monitor security events and incidents</p>
      </div>

      {error && <div className="rounded-md bg-destructive/10 p-4 text-destructive text-sm">{error}</div>}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Incidents</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{incidents.filter((i) => i.status === 'OPEN').length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Events</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{events.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">IP Rules Active</CardTitle>
            <FileWarning className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{ipRules.length}</div></CardContent>
        </Card>
      </div>

      {/* IP Rules Management */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">IP Allow/Deny Rules</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowIpForm(!showIpForm)}>
            {showIpForm ? <X className="mr-1 h-3 w-3" /> : <Plus className="mr-1 h-3 w-3" />}
            {showIpForm ? 'Cancel' : 'Add Rule'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showIpForm && (
            <div className="grid grid-cols-4 gap-3 items-end border-b pb-4">
              <div><Label>IP Address</Label><Input value={newIp} onChange={(e) => setNewIp(e.target.value)} placeholder="10.0.0.1" /></div>
              <div>
                <Label>Type</Label>
                <select value={newRuleType} onChange={(e) => setNewRuleType(e.target.value as 'allow' | 'deny')} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="deny">Deny</option><option value="allow">Allow</option>
                </select>
              </div>
              <div><Label>Reason</Label><Input value={newReason} onChange={(e) => setNewReason(e.target.value)} placeholder="Optional" /></div>
              <Button onClick={handleCreateIpRule} disabled={!newIp}>Add</Button>
            </div>
          )}
          <DataTable
            columns={[
              { header: 'IP', accessor: (row: IpRuleDto) => row.ipAddress },
              { header: 'CIDR', accessor: (row: IpRuleDto) => `/${row.cidrMask}` },
              { header: 'Type', accessor: (row: IpRuleDto) => <Badge variant={row.ruleType === 'deny' ? 'destructive' : 'success'}>{row.ruleType.toUpperCase()}</Badge> },
              { header: 'Reason', accessor: (row: IpRuleDto) => row.reason || '—' },
              { header: '', accessor: (row: IpRuleDto) => (
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDeleteIpRule(row.id); }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )},
            ]}
            data={ipRules}
            isLoading={isLoading}
            emptyMessage="No IP rules configured"
          />
        </CardContent>
      </Card>

      {/* Risk Events */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Recent Risk Events</CardTitle></CardHeader>
        <CardContent>
          <DataTable
            columns={[
              { header: 'Time', accessor: (row: RiskEventDto) => formatDateTime(row.detectedAt) },
              { header: 'Type', accessor: (row: RiskEventDto) => row.eventType.replace('_', ' ') },
              { header: 'Severity', accessor: (row: RiskEventDto) => <Badge variant={severityColors[row.severity] || 'default'}>{row.severity.toUpperCase()}</Badge> },
              { header: 'IP', accessor: (row: RiskEventDto) => row.ipAddress || '—' },
            ]}
            data={events}
            isLoading={isLoading}
            emptyMessage="No risk events detected"
          />
        </CardContent>
      </Card>

      {/* Incident Tickets with actions and hit-log drilldown */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Incident Tickets</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : incidents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No incidents</p>
          ) : (
            incidents.map((incident) => (
              <div key={incident.id} className="rounded-lg border">
                <div
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50"
                  onClick={() => setExpandedIncident(expandedIncident === incident.id ? null : incident.id)}
                >
                  <div className="flex items-center gap-3">
                    <StatusBadge status={incident.status} />
                    <span className="text-sm font-medium">{incident.title}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(incident.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      {incident.status === 'OPEN' && (
                        <Button variant="outline" size="sm" onClick={() => handleUpdateIncident(incident.id, 'INVESTIGATING')}>
                          Investigate
                        </Button>
                      )}
                      {(incident.status === 'OPEN' || incident.status === 'INVESTIGATING') && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => handleUpdateIncident(incident.id, 'RESOLVED')}>
                            <CheckCircle className="mr-1 h-3 w-3" />Resolve
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleUpdateIncident(incident.id, 'DISMISSED')}>
                            Dismiss
                          </Button>
                        </>
                      )}
                    </div>
                    {expandedIncident === incident.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>
                {expandedIncident === incident.id && (
                  <div className="border-t px-3 py-3 space-y-3 bg-muted/20 text-sm">
                    <div>
                      <p className="font-medium text-xs uppercase tracking-wider text-muted-foreground mb-1">Description</p>
                      <p>{incident.description}</p>
                    </div>
                    <Separator />
                    <div>
                      <p className="font-medium text-xs uppercase tracking-wider text-muted-foreground mb-1">Hit Logs</p>
                      {incident.hitLogs && Object.keys(incident.hitLogs).length > 0 ? (
                        <div className="rounded bg-background border p-2 font-mono text-xs space-y-1">
                          {Object.entries(incident.hitLogs)
                            .filter(([key]) => safeHitLogKeys.has(key))
                            .map(([key, value]) => (
                            <div key={key} className="flex gap-2">
                              <span className="text-muted-foreground">{key}:</span>
                              <span>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                            </div>
                          ))}
                          {Object.keys(incident.hitLogs).some((k) => !safeHitLogKeys.has(k)) && (
                            <p className="text-muted-foreground italic">+ additional fields redacted</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No hit logs recorded</p>
                      )}
                    </div>
                    {incident.assignedTo && (
                      <>
                        <Separator />
                        <div>
                          <p className="font-medium text-xs uppercase tracking-wider text-muted-foreground mb-1">Assigned To</p>
                          <p className="font-mono text-xs">{incident.assignedTo}</p>
                        </div>
                      </>
                    )}
                    {incident.resolutionNotes && (
                      <>
                        <Separator />
                        <div>
                          <p className="font-medium text-xs uppercase tracking-wider text-muted-foreground mb-1">Resolution Notes</p>
                          <p>{incident.resolutionNotes}</p>
                        </div>
                      </>
                    )}
                    {incident.resolvedAt && (
                      <p className="text-xs text-muted-foreground">Resolved at {formatDateTime(incident.resolvedAt)}</p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
