import { get, set, del, keys } from 'idb-keyval';
import { enrollmentApi } from '@/api/enrollment.api';
import { clientLogger } from '@/utils/client-logger';
import { tokenStore } from '@/utils/token-store';

const QUEUE_PREFIX = 'sync-queue:';

function getUserId(): string {
  return tokenStore.getUserId() || 'anonymous';
}

function userKey(key: string): string {
  return `${getUserId()}:${key}`;
}

interface QueuedAction {
  type: 'create-enrollment' | 'update-enrollment' | 'submit-enrollment';
  payload: Record<string, unknown>;
  queuedAt: string;
  retries: number;
}

export const syncQueue = {
  async enqueue(id: string, action: Omit<QueuedAction, 'queuedAt' | 'retries'>): Promise<void> {
    const key = userKey(`${QUEUE_PREFIX}${id}`);
    await set(key, { ...action, queuedAt: new Date().toISOString(), retries: 0 });
  },

  async dequeue(id: string): Promise<void> {
    await del(userKey(`${QUEUE_PREFIX}${id}`));
  },

  async listPending(): Promise<Array<{ id: string; action: QueuedAction }>> {
    const allKeys = await keys();
    const prefix = userKey(QUEUE_PREFIX);
    const queueKeys = allKeys.filter(
      (k) => typeof k === 'string' && k.startsWith(prefix),
    );
    const items: Array<{ id: string; action: QueuedAction }> = [];
    for (const key of queueKeys) {
      const action = await get(key);
      if (action) {
        items.push({ id: (key as string).slice(prefix.length), action });
      }
    }
    return items.sort(
      (a, b) => new Date(a.action.queuedAt).getTime() - new Date(b.action.queuedAt).getTime(),
    );
  },

  async processQueue(): Promise<{ processed: number; failed: number }> {
    const pending = await this.listPending();
    let processed = 0;
    let failed = 0;

    for (const { id, action } of pending) {
      try {
        switch (action.type) {
          case 'create-enrollment':
            await enrollmentApi.create(action.payload as { notes: string; serviceLines: Array<{ serviceId: string; quantity: number }> });
            break;
          case 'update-enrollment':
            await enrollmentApi.update(
              action.payload.enrollmentId as string,
              action.payload.data as { notes?: string; serviceLines?: Array<{ serviceId: string; quantity: number }> },
            );
            break;
          case 'submit-enrollment':
            await enrollmentApi.submit(action.payload.enrollmentId as string);
            break;
        }
        await this.dequeue(id);
        processed++;
        clientLogger.info('SyncQueue', `Processed ${action.type} (${id})`);
      } catch {
        const key = userKey(`${QUEUE_PREFIX}${id}`);
        await set(key, { ...action, retries: action.retries + 1 });
        failed++;
        clientLogger.warn('SyncQueue', `Failed ${action.type} (${id}), retry ${action.retries + 1}`);
      }
    }

    return { processed, failed };
  },

  async getPendingCount(): Promise<number> {
    const allKeys = await keys();
    const prefix = userKey(QUEUE_PREFIX);
    return allKeys.filter(
      (k) => typeof k === 'string' && k.startsWith(prefix),
    ).length;
  },

  /** Clear all queued actions for the current user (call on logout). */
  async clearAllForCurrentUser(): Promise<void> {
    return this.clearForUser(getUserId());
  },

  /** Clear all queued actions for a specific user by explicit ID. */
  async clearForUser(userId: string): Promise<void> {
    const allKeys = await keys();
    const prefix = `${userId}:${QUEUE_PREFIX}`;
    const userKeys = allKeys.filter((k) => typeof k === 'string' && k.startsWith(prefix));
    await Promise.all(userKeys.map((k) => del(k)));
  },
};
