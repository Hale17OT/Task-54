import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect, useRef, useState } from 'react';
import { syncQueue } from '@/utils/sync-queue';

export function AppShell() {
  const { isAuthenticated, user, refreshAuth } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;
    // Timeout auth check to prevent indefinite loading when API is unreachable
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 5000));
    Promise.race([refreshAuth(), timeout]).finally(() => setIsChecking(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Process offline queue when app loads and when coming back online
  useEffect(() => {
    const processOfflineQueue = async () => {
      const count = await syncQueue.getPendingCount();
      if (count === 0) return;
      setSyncStatus(`Syncing ${count} queued action(s)...`);
      const result = await syncQueue.processQueue();
      if (result.processed > 0) {
        setSyncStatus(`Synced ${result.processed} action(s) successfully.`);
      }
      if (result.failed > 0) {
        setSyncStatus((prev) => `${prev || ''} ${result.failed} action(s) still pending.`);
      }
      setTimeout(() => setSyncStatus(null), 5000);
    };

    // Process on mount
    if (isAuthenticated) {
      processOfflineQueue();
    }

    // Process when coming back online
    const handleOnline = () => {
      if (isAuthenticated) processOfflineQueue();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [isAuthenticated]);

  if (isChecking) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-4 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        {syncStatus && (
          <div className="bg-primary/10 border-b border-primary/20 px-6 py-2 text-sm text-primary">
            {syncStatus}
          </div>
        )}
        <main className="flex-1 overflow-y-auto bg-muted/30 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
