import { describe, it, expect, vi } from 'vitest';

// Must mock enrollment API before importing sync-queue
vi.mock('@/api/enrollment.api', () => ({
  enrollmentApi: {
    create: vi.fn().mockResolvedValue({ data: { id: 'new-1' } }),
    update: vi.fn().mockResolvedValue({ data: { id: 'upd-1' } }),
    submit: vi.fn().mockResolvedValue({ data: { id: 'sub-1' } }),
  },
}));

import { syncQueue } from './sync-queue';
import { enrollmentApi } from '@/api/enrollment.api';

describe('syncQueue', () => {
  describe('enqueue / listPending', () => {
    it('enqueues and lists pending actions', async () => {
      await syncQueue.enqueue('action-1', {
        type: 'create-enrollment',
        payload: { notes: 'test', serviceLines: [] },
      });

      const pending = await syncQueue.listPending();
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe('action-1');
      expect(pending[0].action.type).toBe('create-enrollment');
      expect(pending[0].action.retries).toBe(0);
    });

    it('tracks pending count', async () => {
      await syncQueue.enqueue('a1', { type: 'create-enrollment', payload: {} });
      await syncQueue.enqueue('a2', { type: 'submit-enrollment', payload: { enrollmentId: '123' } });

      const count = await syncQueue.getPendingCount();
      expect(count).toBe(2);
    });
  });

  describe('dequeue', () => {
    it('removes an action from the queue', async () => {
      await syncQueue.enqueue('rm-1', { type: 'create-enrollment', payload: {} });
      await syncQueue.dequeue('rm-1');
      const count = await syncQueue.getPendingCount();
      expect(count).toBe(0);
    });
  });

  describe('processQueue', () => {
    it('processes create-enrollment actions', async () => {
      await syncQueue.enqueue('proc-1', {
        type: 'create-enrollment',
        payload: { notes: 'offline', serviceLines: [{ serviceId: 's1', quantity: 1 }] },
      });

      const result = await syncQueue.processQueue();
      expect(result.processed).toBe(1);
      expect(result.failed).toBe(0);
      expect(enrollmentApi.create).toHaveBeenCalled();

      const remaining = await syncQueue.getPendingCount();
      expect(remaining).toBe(0);
    });

    it('processes submit-enrollment actions', async () => {
      await syncQueue.enqueue('proc-2', {
        type: 'submit-enrollment',
        payload: { enrollmentId: 'enr-123' },
      });

      await syncQueue.processQueue();
      expect(enrollmentApi.submit).toHaveBeenCalledWith('enr-123');
    });

    it('increments retry count on failure', async () => {
      vi.mocked(enrollmentApi.create).mockRejectedValueOnce(new Error('Network error'));
      await syncQueue.enqueue('fail-1', {
        type: 'create-enrollment',
        payload: { notes: 'will fail' },
      });

      const result = await syncQueue.processQueue();
      expect(result.failed).toBe(1);
      expect(result.processed).toBe(0);

      const pending = await syncQueue.listPending();
      expect(pending[0].action.retries).toBe(1);
    });
  });
});
