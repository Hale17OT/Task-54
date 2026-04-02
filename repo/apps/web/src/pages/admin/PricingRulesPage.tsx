import { useEffect, useState } from 'react';
import { pricingApi } from '@/api/pricing.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/common/DataTable';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import type { PricingRuleDto } from '@checc/shared/types/pricing.types';
import { PricingRuleType } from '@checc/shared/types/pricing.types';
import { Plus, Trash2, X, Save, Loader2 } from 'lucide-react';

export function PricingRulesPage() {
  const [rules, setRules] = useState<PricingRuleDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Create form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ruleType, setRuleType] = useState<PricingRuleType>(PricingRuleType.PERCENTAGE_OFF);
  const [priorityLevel, setPriorityLevel] = useState('1');
  const [value, setValue] = useState('');
  const [minQuantity, setMinQuantity] = useState('1');
  const [minOrderSubtotal, setMinOrderSubtotal] = useState('');
  const [exclusionGroup, setExclusionGroup] = useState('');
  const [applicableCategories, setApplicableCategories] = useState('');
  const [applicableServiceIds, setApplicableServiceIds] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');

  useEffect(() => {
    pricingApi.listRules().then((res) => {
      setRules(res.data);
      setIsLoading(false);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load pricing rules');
      setIsLoading(false);
    });
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await pricingApi.deleteRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete rule');
    }
  };

  const handleCreate = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await pricingApi.createRule({
        name,
        description,
        ruleType,
        priorityLevel: Number(priorityLevel),
        value: Number(value),
        minQuantity: minQuantity ? Number(minQuantity) : undefined,
        minOrderSubtotal: minOrderSubtotal ? Number(minOrderSubtotal) : undefined,
        exclusionGroup: exclusionGroup || undefined,
        applicableCategories: applicableCategories ? applicableCategories.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        applicableServiceIds: applicableServiceIds ? applicableServiceIds.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        validFrom,
        validUntil,
      });
      setRules((prev) => [...prev, res.data]);
      setShowCreate(false);
      setName(''); setDescription(''); setValue(''); setMinQuantity('1'); setMinOrderSubtotal('');
      setExclusionGroup(''); setApplicableCategories(''); setApplicableServiceIds('');
      setValidFrom(''); setValidUntil('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rule');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pricing Rules</h1>
          <p className="text-muted-foreground">Manage promotion and discount rules</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
          {showCreate ? 'Cancel' : 'New Rule'}
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-destructive text-sm">{error}</div>
      )}

      {showCreate && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Create Pricing Rule</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="rule-name">Name</Label>
                <Input id="rule-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="rule-type">Type</Label>
                <select id="rule-type" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={ruleType} onChange={(e) => setRuleType(e.target.value as PricingRuleType)}>
                  {Object.values(PricingRuleType).map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="rule-priority">Priority</Label>
                <Input id="rule-priority" type="number" value={priorityLevel} onChange={(e) => setPriorityLevel(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="rule-value">Value</Label>
                <Input id="rule-value" type="number" value={value} onChange={(e) => setValue(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="rule-minqty">Min Quantity</Label>
                <Input id="rule-minqty" type="number" min="1" value={minQuantity} onChange={(e) => setMinQuantity(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="rule-threshold">Min Order Subtotal ($)</Label>
                <Input id="rule-threshold" type="number" value={minOrderSubtotal} onChange={(e) => setMinOrderSubtotal(e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <Label htmlFor="rule-exclusion">Exclusion Group</Label>
                <Input id="rule-exclusion" value={exclusionGroup} onChange={(e) => setExclusionGroup(e.target.value)} placeholder="e.g. volume_discount" />
              </div>
              <div>
                <Label htmlFor="rule-categories">Applicable Categories</Label>
                <Input id="rule-categories" value={applicableCategories} onChange={(e) => setApplicableCategories(e.target.value)} placeholder="e.g. lab, screening" />
              </div>
              <div>
                <Label htmlFor="rule-services">Applicable Service IDs</Label>
                <Input id="rule-services" value={applicableServiceIds} onChange={(e) => setApplicableServiceIds(e.target.value)} placeholder="Comma-separated UUIDs" />
              </div>
              <div>
                <Label htmlFor="rule-from">Valid From</Label>
                <Input id="rule-from" type="datetime-local" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="rule-until">Valid Until</Label>
                <Input id="rule-until" type="datetime-local" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="rule-desc">Description</Label>
              <Input id="rule-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <Button onClick={handleCreate} disabled={isSaving || !name || !value || !validFrom || !validUntil}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Create Rule
            </Button>
          </CardContent>
        </Card>
      )}

      <DataTable
        columns={[
          { header: 'Name', accessor: 'name' as keyof PricingRuleDto },
          { header: 'Type', accessor: (row) => <Badge variant="outline">{row.ruleType.replace('_', ' ')}</Badge> },
          { header: 'Priority', accessor: (row) => String(row.priorityLevel) },
          { header: 'Value', accessor: (row) => String(row.value) },
          { header: 'Min Order $', accessor: (row) => row.minOrderSubtotal ? `$${row.minOrderSubtotal}` : '—' },
          { header: 'Exclusion Group', accessor: (row) => row.exclusionGroup || '—' },
          { header: 'Valid', accessor: (row) => `${formatDate(row.validFrom)} — ${formatDate(row.validUntil)}` },
          { header: 'Active', accessor: (row) => <Badge variant={row.isActive ? 'success' : 'secondary'}>{row.isActive ? 'Active' : 'Inactive'}</Badge> },
          { header: '', accessor: (row) => (
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          ) },
        ]}
        data={rules}
        isLoading={isLoading}
        emptyMessage="No pricing rules configured"
      />
    </div>
  );
}
