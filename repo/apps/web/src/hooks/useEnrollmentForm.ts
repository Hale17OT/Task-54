import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { enrollmentApi, catalogApi } from '@/api/enrollment.api';
import { offlineStorage } from '@/utils/offline-storage';
import { syncQueue } from '@/utils/sync-queue';
import type { CatalogServiceDto } from '@checc/shared/types/enrollment.types';

export interface ServiceLine {
  serviceId: string;
  quantity: number;
}

interface DraftData {
  notes: string;
  serviceLines: ServiceLine[];
}

export function useEnrollmentForm(id: string | undefined) {
  const navigate = useNavigate();
  const isEdit = !!id;
  const draftId = id || 'new';

  const [catalog, setCatalog] = useState<CatalogServiceDto[]>([]);
  const [serviceLines, setServiceLines] = useState<ServiceLine[]>([]);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const catalogRes = await catalogApi.list();
        setCatalog(catalogRes.data);

        const draft = await offlineStorage.getDraft<DraftData>('enrollment', draftId);
        if (draft) {
          setNotes(draft.data.notes);
          setServiceLines(draft.data.serviceLines);
          setHasDraft(true);
          setDraftSavedAt(draft.savedAt);
        } else if (isEdit) {
          const enrollRes = await enrollmentApi.getById(id!);
          setNotes(enrollRes.data.notes);
          setServiceLines(enrollRes.data.serviceLines.map((sl) => ({ serviceId: sl.serviceId, quantity: sl.quantity })));
        }
      } catch {
        const draft = await offlineStorage.getDraft<DraftData>('enrollment', draftId);
        if (draft) {
          setNotes(draft.data.notes);
          setServiceLines(draft.data.serviceLines);
          setHasDraft(true);
          setDraftSavedAt(draft.savedAt);
        } else {
          setError('Failed to load data. You are offline and no draft was found.');
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [id, isEdit, draftId]);

  const saveDraftLocally = useCallback(async () => {
    await offlineStorage.saveDraft<DraftData>('enrollment', draftId, { notes, serviceLines });
    setHasDraft(true);
    setDraftSavedAt(new Date().toISOString());
  }, [draftId, notes, serviceLines]);

  const addService = (serviceId: string) => {
    const existing = serviceLines.find((sl) => sl.serviceId === serviceId);
    if (existing) {
      setServiceLines(serviceLines.map((sl) => sl.serviceId === serviceId ? { ...sl, quantity: sl.quantity + 1 } : sl));
    } else {
      setServiceLines([...serviceLines, { serviceId, quantity: 1 }]);
    }
  };

  const updateQuantity = (serviceId: string, delta: number) => {
    setServiceLines(
      serviceLines.map((sl) => sl.serviceId === serviceId ? { ...sl, quantity: Math.max(0, sl.quantity + delta) } : sl).filter((sl) => sl.quantity > 0),
    );
  };

  const getServiceInfo = (serviceId: string) => catalog.find((s) => s.id === serviceId);

  const subtotal = serviceLines.reduce((sum, sl) => {
    const svc = getServiceInfo(sl.serviceId);
    return sum + (svc ? svc.basePrice * sl.quantity : 0);
  }, 0);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      if (isEdit) {
        await enrollmentApi.update(id!, { notes, serviceLines });
      } else {
        await enrollmentApi.create({ notes, serviceLines });
      }
      await offlineStorage.deleteDraft('enrollment', draftId);
      navigate('/enrollments');
    } catch (err) {
      const queueId = `enrollment-${draftId}-${Date.now()}`;
      if (isEdit) {
        await syncQueue.enqueue(queueId, { type: 'update-enrollment', payload: { enrollmentId: id!, data: { notes, serviceLines } } });
      } else {
        await syncQueue.enqueue(queueId, { type: 'create-enrollment', payload: { notes, serviceLines } });
      }
      await saveDraftLocally();
      setError((err instanceof Error ? err.message : 'Save failed') + ' — Queued for sync when you reconnect.');
    } finally {
      setIsSaving(false);
    }
  };

  return {
    catalog, serviceLines, notes, setNotes, isLoading, isSaving, error, hasDraft, draftSavedAt, isEdit, subtotal,
    addService, updateQuantity, getServiceInfo, handleSave, saveDraftLocally,
  };
}
