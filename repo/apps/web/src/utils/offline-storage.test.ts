import { describe, it, expect } from 'vitest';
import { offlineStorage } from './offline-storage';

describe('offlineStorage', () => {
  describe('saveDraft / getDraft', () => {
    it('saves and retrieves a draft', async () => {
      await offlineStorage.saveDraft('enrollment', '123', { notes: 'test', lines: [] });
      const draft = await offlineStorage.getDraft('enrollment', '123');
      expect(draft).not.toBeNull();
      expect(draft!.data).toEqual({ notes: 'test', lines: [] });
      expect(draft!.savedAt).toBeDefined();
    });

    it('returns null for non-existent draft', async () => {
      const draft = await offlineStorage.getDraft('enrollment', 'nonexistent');
      expect(draft).toBeNull();
    });
  });

  describe('deleteDraft', () => {
    it('deletes a saved draft', async () => {
      await offlineStorage.saveDraft('enrollment', '456', { data: 'value' });
      await offlineStorage.deleteDraft('enrollment', '456');
      const draft = await offlineStorage.getDraft('enrollment', '456');
      expect(draft).toBeNull();
    });
  });

  describe('listDrafts', () => {
    it('lists all draft IDs for a type', async () => {
      await offlineStorage.saveDraft('enrollment', 'a', { x: 1 });
      await offlineStorage.saveDraft('enrollment', 'b', { x: 2 });
      await offlineStorage.saveDraft('order', 'c', { x: 3 });

      const enrollmentDrafts = await offlineStorage.listDrafts('enrollment');
      expect(enrollmentDrafts).toContain('a');
      expect(enrollmentDrafts).toContain('b');
      expect(enrollmentDrafts).not.toContain('c');
    });
  });

  describe('clearDrafts', () => {
    it('clears all drafts for a type', async () => {
      await offlineStorage.saveDraft('enrollment', 'x', { val: 1 });
      await offlineStorage.saveDraft('enrollment', 'y', { val: 2 });
      await offlineStorage.clearDrafts('enrollment');

      const remaining = await offlineStorage.listDrafts('enrollment');
      expect(remaining).toHaveLength(0);
    });
  });
});
