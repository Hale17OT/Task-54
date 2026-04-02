import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { healthCheckApi } from '@/api/health-check.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Badge } from '@/components/ui/badge';
import type { ReportTemplateDto } from '@checc/shared/types/health-check.types';
import { Plus, Minus, Save, Loader2, AlertTriangle } from 'lucide-react';

interface ResultItem {
  testName: string;
  testCode: string;
  value: string;
  unit: string;
  referenceLow: string;
  referenceHigh: string;
}

export function ReportCreatePage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<ReportTemplateDto[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [patientId, setPatientId] = useState('');
  const [resultItems, setResultItems] = useState<ResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    healthCheckApi.getTemplates().then((res) => {
      setTemplates(res.data);
      setIsLoading(false);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
      setIsLoading(false);
    });
  }, []);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      const items: ResultItem[] = [];
      for (const section of template.sections) {
        for (const test of section.testItems) {
          items.push({
            testName: test.testName,
            testCode: test.testCode,
            value: '',
            unit: test.unit,
            referenceLow: test.referenceLow !== null ? String(test.referenceLow) : '',
            referenceHigh: test.referenceHigh !== null ? String(test.referenceHigh) : '',
          });
        }
      }
      setResultItems(items);
    }
  };

  const updateItem = (index: number, field: keyof ResultItem, value: string) => {
    setResultItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  /** Client-side abnormal flag computation matching backend logic. */
  const computeFlag = (item: ResultItem): { flag: string | null; color: string } => {
    const val = parseFloat(item.value);
    const low = item.referenceLow ? parseFloat(item.referenceLow) : null;
    const high = item.referenceHigh ? parseFloat(item.referenceHigh) : null;
    if (isNaN(val) || !item.value) return { flag: null, color: '' };
    if (low !== null && high !== null) {
      const critLow = low - (high - low) * 0.5;
      const critHigh = high + (high - low) * 0.5;
      if (val < critLow) return { flag: 'LL', color: 'destructive' };
      if (val > critHigh) return { flag: 'HH', color: 'destructive' };
    }
    if (low !== null && val < low) return { flag: 'L', color: 'warning' };
    if (high !== null && val > high) return { flag: 'H', color: 'warning' };
    return { flag: null, color: '' };
  };

  const addItem = () => {
    setResultItems((prev) => [...prev, { testName: '', testCode: '', value: '', unit: '', referenceLow: '', referenceHigh: '' }]);
  };

  const removeItem = (index: number) => {
    setResultItems((prev) => prev.filter((_, i) => i !== index));
  };

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const handleSave = async () => {
    setError(null);

    // Client-side validation
    if (!uuidRegex.test(patientId)) {
      setError('Patient ID must be a valid UUID format');
      return;
    }
    const emptyItems = resultItems.filter((item) => !item.value.trim() || !item.testName.trim() || !item.testCode.trim());
    if (emptyItems.length > 0) {
      setError('All result items must have a test name, code, and value');
      return;
    }

    setIsSaving(true);
    try {
      const data = {
        patientId,
        templateId: selectedTemplateId,
        resultItems: resultItems.map((item) => ({
          testName: item.testName,
          testCode: item.testCode,
          value: item.value,
          unit: item.unit,
          referenceLow: item.referenceLow ? Number(item.referenceLow) : undefined,
          referenceHigh: item.referenceHigh ? Number(item.referenceHigh) : undefined,
        })),
      };
      const res = await healthCheckApi.create(data);
      navigate(`/reports/${(res.data as { id: string }).id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <LoadingSpinner className="h-64" text="Loading templates..." />;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Health Check Report</h1>
        <p className="text-muted-foreground">Enter test results for the patient</p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg">Report Setup</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="patientId">Patient ID</Label>
            <Input
              id="patientId"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              placeholder="e.g. 00000000-0000-0000-0000-000000000004"
              className={patientId && !uuidRegex.test(patientId) ? 'border-destructive' : ''}
            />
            {patientId && !uuidRegex.test(patientId) && (
              <p className="text-xs text-destructive mt-1">Must be a valid UUID format (e.g. 00000000-0000-0000-0000-000000000004)</p>
            )}
          </div>
          <div>
            <Label htmlFor="template">Template</Label>
            <select
              id="template"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedTemplateId}
              onChange={(e) => handleTemplateSelect(e.target.value)}
            >
              <option value="">Select a template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Result Items</CardTitle>
            <Button variant="outline" size="sm" onClick={addItem}>
              <Plus className="mr-1 h-3 w-3" />Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {resultItems.map((item, i) => {
              const { flag, color } = computeFlag(item);
              return (
              <div key={i} className={`grid grid-cols-8 gap-2 items-end border-b pb-3 ${flag ? 'bg-destructive/5 rounded px-1' : ''}`}>
                <div>
                  <Label className="text-xs">Test Name</Label>
                  <Input value={item.testName} onChange={(e) => updateItem(i, 'testName', e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Code</Label>
                  <Input value={item.testCode} onChange={(e) => updateItem(i, 'testCode', e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Value</Label>
                  <Input value={item.value} onChange={(e) => updateItem(i, 'value', e.target.value)} className={`h-8 text-sm ${flag ? 'border-destructive' : ''}`} />
                </div>
                <div>
                  <Label className="text-xs">Unit</Label>
                  <Input value={item.unit} onChange={(e) => updateItem(i, 'unit', e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Ref Low</Label>
                  <Input value={item.referenceLow} onChange={(e) => updateItem(i, 'referenceLow', e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Ref High</Label>
                  <Input value={item.referenceHigh} onChange={(e) => updateItem(i, 'referenceHigh', e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="flex items-center justify-center h-8">
                  {flag ? (
                    <Badge variant={color as 'destructive' | 'warning'} className="text-[10px]">
                      <AlertTriangle className="mr-0.5 h-2.5 w-2.5" />{flag}
                    </Badge>
                  ) : item.value ? (
                    <span className="text-xs text-green-600">OK</span>
                  ) : null}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItem(i)}>
                  <Minus className="h-3 w-3" />
                </Button>
              </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={isSaving || !patientId || !uuidRegex.test(patientId) || !selectedTemplateId || resultItems.length === 0}>
        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Create Report
      </Button>
    </div>
  );
}
