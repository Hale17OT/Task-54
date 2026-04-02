import { useEffect, useState } from 'react';
import { notificationApi } from '@/api/notification.api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/utils';
import type { NotificationDto } from '@checc/shared/types/notification.types';
import { Bell, CheckCheck, AlertCircle, DollarSign, Package, Shield } from 'lucide-react';

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  due_date: Bell,
  overdue_balance: DollarSign,
  pickup_ready: Package,
  compliance_breach: AlertCircle,
  risk_alert: Shield,
  general: Bell,
};

export function NotificationCenterPage() {
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [throttleInfo, setThrottleInfo] = useState<{ maxPerItem: number; windowHours: number } | null>(null);

  const loadNotifications = () => {
    setIsLoading(true);
    setFetchError(null);
    Promise.all([
      notificationApi.list(1, 50),
      notificationApi.getThrottleStatus().catch(() => null),
    ]).then(([listRes, throttleRes]) => {
      setNotifications(listRes.data);
      if (throttleRes) setThrottleInfo(throttleRes.data);
      setIsLoading(false);
    }).catch((err) => {
      setFetchError(err instanceof Error ? err.message : 'Failed to load notifications');
      setIsLoading(false);
    });
  };

  useEffect(() => { loadNotifications(); }, []);

  const handleMarkRead = async (id: string) => {
    setActionError(null);
    try {
      await notificationApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to mark as read');
    }
  };

  const handleMarkAllRead = async () => {
    setActionError(null);
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to mark all as read');
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
          {throttleInfo && (
            <p className="text-xs text-muted-foreground" data-testid="throttle-status">
              Frequency limit: {throttleInfo.maxPerItem} per item / {throttleInfo.windowHours}h
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={handleMarkAllRead}>
            <CheckCheck className="mr-2 h-4 w-4" />
            Mark All Read
          </Button>
        )}
      </div>

      {fetchError && (
        <div className="rounded-md bg-destructive/10 p-4 text-destructive text-sm flex items-center justify-between">
          <span>{fetchError}</span>
          <Button variant="outline" size="sm" onClick={loadNotifications}>Retry</Button>
        </div>
      )}

      {actionError && (
        <div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">{actionError}</div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
          <Bell className="h-12 w-12 mb-3 opacity-30" />
          <p>No notifications</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const Icon = typeIcons[notif.type] || Bell;
            return (
              <Card
                key={notif.id}
                className={`transition-colors ${!notif.isRead ? 'border-primary/30 bg-primary/5' : ''}`}
              >
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="mt-0.5">
                    <Icon className={`h-5 w-5 ${!notif.isRead ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className={`text-sm ${!notif.isRead ? 'font-semibold' : 'font-medium'}`}>
                        {notif.title}
                      </h4>
                      {!notif.isRead && <Badge className="text-[10px]">New</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{notif.body}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDateTime(notif.createdAt)}</p>
                  </div>
                  {!notif.isRead && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkRead(notif.id)}
                      className="shrink-0"
                    >
                      Mark read
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
