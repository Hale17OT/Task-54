import { get, set, del, keys } from 'idb-keyval';
import { tokenStore } from '@/utils/token-store';

const DRAFT_PREFIX = 'draft:';

function getUserId(): string {
  return tokenStore.getUserId() || 'anonymous';
}

function userKey(key: string): string {
  return `${getUserId()}:${key}`;
}

export const offlineStorage = {
  async saveDraft<T>(type: string, id: string, data: T): Promise<void> {
    const key = userKey(`${DRAFT_PREFIX}${type}:${id}`);
    await set(key, { data, savedAt: new Date().toISOString() });
  },

  async getDraft<T>(type: string, id: string): Promise<{ data: T; savedAt: string } | null> {
    const key = userKey(`${DRAFT_PREFIX}${type}:${id}`);
    const result = await get(key);
    return result || null;
  },

  async deleteDraft(type: string, id: string): Promise<void> {
    const key = userKey(`${DRAFT_PREFIX}${type}:${id}`);
    await del(key);
  },

  async listDrafts(type: string): Promise<string[]> {
    const allKeys = await keys();
    const prefix = userKey(`${DRAFT_PREFIX}${type}:`);
    return allKeys
      .filter((k) => typeof k === 'string' && k.startsWith(prefix))
      .map((k) => (k as string).slice(prefix.length));
  },

  async clearDrafts(type: string): Promise<void> {
    const ids = await this.listDrafts(type);
    await Promise.all(ids.map((id) => this.deleteDraft(type, id)));
  },

  /** Clear all offline data for the current user (call on logout). */
  async clearAllForCurrentUser(): Promise<void> {
    return this.clearForUser(getUserId());
  },

  /** Clear all offline data for a specific user by explicit ID. */
  async clearForUser(userId: string): Promise<void> {
    const allKeys = await keys();
    const prefix = `${userId}:`;
    const userKeys = allKeys.filter((k) => typeof k === 'string' && k.startsWith(prefix));
    await Promise.all(userKeys.map((k) => del(k)));
  },
};
