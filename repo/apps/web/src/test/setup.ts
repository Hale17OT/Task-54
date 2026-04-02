/// <reference types="vitest/globals" />
import '@testing-library/jest-dom/vitest';

// Mock idb-keyval for offline storage tests
const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  set: vi.fn((key: string, value: unknown) => { store.set(key, value); return Promise.resolve(); }),
  del: vi.fn((key: string) => { store.delete(key); return Promise.resolve(); }),
  keys: vi.fn(() => Promise.resolve(Array.from(store.keys()))),
  __store: store,
}));

// Mock localStorage
const localStore: Record<string, string> = {};
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn((key: string) => localStore[key] ?? null),
    setItem: vi.fn((key: string, val: string) => { localStore[key] = val; }),
    removeItem: vi.fn((key: string) => { delete localStore[key]; }),
    clear: vi.fn(() => { Object.keys(localStore).forEach((k) => delete localStore[k]); }),
  },
});

// Mock sessionStorage (used for auth tokens)
const sessionStore: Record<string, string> = {};
Object.defineProperty(window, 'sessionStorage', {
  value: {
    getItem: vi.fn((key: string) => sessionStore[key] ?? null),
    setItem: vi.fn((key: string, val: string) => { sessionStore[key] = val; }),
    removeItem: vi.fn((key: string) => { delete sessionStore[key]; }),
    clear: vi.fn(() => { Object.keys(sessionStore).forEach((k) => delete sessionStore[k]); }),
  },
});

// Reset stores between tests
beforeEach(() => {
  store.clear();
  Object.keys(localStore).forEach((k) => delete localStore[k]);
  Object.keys(sessionStore).forEach((k) => delete sessionStore[k]);
});
