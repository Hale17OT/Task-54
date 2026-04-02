/**
 * Build a media asset URL using the same configurable API base as the API client.
 * Ensures media works in decoupled deployments (frontend and API on different origins).
 */
const API_BASE = import.meta.env.VITE_API_URL || '';

export function getMediaUrl(filePath: string): string {
  const filename = filePath.split('/').pop() || filePath;
  return `${API_BASE}/api/media/${filename}`;
}
