/**
 * Session store using sessionStorage — scoped to the browser tab.
 * Tokens persist across page reloads but are cleared when the tab closes.
 * sessionStorage is origin-scoped and tab-isolated, making it a safe default
 * for SPA auth tokens.
 */

const KEYS = {
  ACCESS: 'checc_access',
  REFRESH: 'checc_refresh',
  USER_ID: 'checc_uid',
  FINGERPRINT: 'checc_fp',
} as const;

export const tokenStore = {
  getAccessToken(): string | null { return sessionStorage.getItem(KEYS.ACCESS); },
  getRefreshToken(): string | null { return sessionStorage.getItem(KEYS.REFRESH); },
  getUserId(): string | null { return sessionStorage.getItem(KEYS.USER_ID); },
  getFingerprint(): string | null { return sessionStorage.getItem(KEYS.FINGERPRINT); },

  setTokens(access: string, refresh: string): void {
    sessionStorage.setItem(KEYS.ACCESS, access);
    sessionStorage.setItem(KEYS.REFRESH, refresh);
  },

  setUserId(id: string): void { sessionStorage.setItem(KEYS.USER_ID, id); },
  setFingerprint(fp: string): void { sessionStorage.setItem(KEYS.FINGERPRINT, fp); },

  clear(): void {
    sessionStorage.removeItem(KEYS.ACCESS);
    sessionStorage.removeItem(KEYS.REFRESH);
    sessionStorage.removeItem(KEYS.USER_ID);
    sessionStorage.removeItem(KEYS.FINGERPRINT);
  },

  hasToken(): boolean { return sessionStorage.getItem(KEYS.ACCESS) !== null; },
};
