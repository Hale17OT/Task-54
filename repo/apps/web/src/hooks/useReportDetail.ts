import { useEffect, useState } from 'react';
import { healthCheckApi } from '@/api/health-check.api';
import type { HealthCheckDto, HealthCheckVersionDto } from '@checc/shared/types/health-check.types';

interface EditItem {
  testName: string;
  testCode: string;
  value: string;
  unit: string;
  referenceLow?: string;
  referenceHigh?: string;
}

export function useReportDetail(id: string) {
  const [report, setReport] = useState<(HealthCheckDto & { version?: HealthCheckVersionDto }) | null>(null);
  const [versions, setVersions] = useState<HealthCheckVersionDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signUsername, setSignUsername] = useState('');
  const [signPassword, setSignPassword] = useState('');
  const [isSigning, setIsSigning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const [changeSummary, setChangeSummary] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    Promise.all([
      healthCheckApi.getById(id),
      healthCheckApi.getVersions(id),
    ]).then(([reportRes, versionsRes]) => {
      setReport(reportRes.data);
      setVersions(versionsRes.data);
      setIsLoading(false);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load report');
      setIsLoading(false);
    });
  }, [id]);

  const submitForReview = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await healthCheckApi.submitForReview(id);
      setReport(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sign = async () => {
    if (!report) return;
    setIsSigning(true);
    setError(null);
    try {
      await healthCheckApi.sign(id, { username: signUsername, password: signPassword, versionNumber: report.currentVersion });
      const [reportRes, versionsRes] = await Promise.all([healthCheckApi.getById(id), healthCheckApi.getVersions(id)]);
      setReport(reportRes.data);
      setVersions(versionsRes.data);
      setSignUsername('');
      setSignPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signing failed');
    } finally {
      setIsSigning(false);
    }
  };

  const downloadPdf = (versionNumber: number) => {
    healthCheckApi.downloadPdf(id, versionNumber);
  };

  const startEdit = (currentVersion: HealthCheckVersionDto | undefined) => {
    if (currentVersion?.resultItems) {
      setEditItems(currentVersion.resultItems.map((item) => ({
        testName: item.testName, testCode: item.testCode, value: item.value, unit: item.unit,
        referenceLow: item.referenceLow !== null ? String(item.referenceLow) : undefined,
        referenceHigh: item.referenceHigh !== null ? String(item.referenceHigh) : undefined,
      })));
    }
    setShowEditForm(true);
  };

  const saveEdit = async () => {
    setIsSavingEdit(true);
    setError(null);
    try {
      const res = await healthCheckApi.update(id, {
        resultItems: editItems.map((item) => ({
          testName: item.testName, testCode: item.testCode, value: item.value, unit: item.unit,
          referenceLow: item.referenceLow ? Number(item.referenceLow) : undefined,
          referenceHigh: item.referenceHigh ? Number(item.referenceHigh) : undefined,
        })),
        changeSummary: changeSummary || undefined,
      });
      setReport(res.data);
      const versionsRes = await healthCheckApi.getVersions(id);
      setVersions(versionsRes.data);
      setShowEditForm(false);
      setChangeSummary('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setIsSavingEdit(false);
    }
  };

  return {
    report, versions, isLoading, error, setError,
    // Sign
    signUsername, setSignUsername, signPassword, setSignPassword, isSigning, sign,
    // Submit
    isSubmitting, submitForReview,
    // Edit
    showEditForm, setShowEditForm, editItems, setEditItems, changeSummary, setChangeSummary, isSavingEdit, startEdit, saveEdit,
    // PDF
    downloadPdf,
  };
}
