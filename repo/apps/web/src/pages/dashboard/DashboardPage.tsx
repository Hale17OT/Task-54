import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { enrollmentApi } from '@/api/enrollment.api';
import { orderApi } from '@/api/order.api';
import { healthCheckApi } from '@/api/health-check.api';
import { contentApi } from '@/api/content.api';
import { notificationApi } from '@/api/notification.api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { UserRole } from '@checc/shared/constants/roles';
import {
  ClipboardList,
  ShoppingCart,
  Heart,
  BookOpen,
  Bell,
} from 'lucide-react';

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [metrics, setMetrics] = useState<{
    enrollments: number | null;
    orders: number | null;
    reports: number | null;
    content: number | null;
    unreadNotifications: number | null;
  }>({
    enrollments: null,
    orders: null,
    reports: null,
    content: null,
    unreadNotifications: null,
  });

  useEffect(() => {
    // Load real metrics from existing endpoints
    const load = async () => {
      const results = await Promise.allSettled([
        enrollmentApi.list(1, 1),
        orderApi.list(1, 1),
        healthCheckApi.list(1, 1),
        contentApi.listPublished(1, 1),
        notificationApi.getUnreadCount(),
      ]);

      setMetrics({
        enrollments: results[0].status === 'fulfilled' ? (results[0].value as any)?.data?.total ?? (results[0].value as any)?.meta?.total ?? 0 : null,
        orders: results[1].status === 'fulfilled' ? (results[1].value as any)?.data?.total ?? (results[1].value as any)?.meta?.total ?? 0 : null,
        reports: results[2].status === 'fulfilled' ? (results[2].value as any)?.data?.total ?? (results[2].value as any)?.meta?.total ?? 0 : null,
        content: results[3].status === 'fulfilled' ? (results[3].value as any)?.data?.total ?? (results[3].value as any)?.meta?.total ?? 0 : null,
        unreadNotifications: results[4].status === 'fulfilled' ? (results[4].value as any)?.data?.count ?? 0 : null,
      });
    };

    load();
  }, []);

  const isReviewer = user?.role === UserRole.REVIEWER;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.fullName}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {!isReviewer && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Enrollments</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {metrics.enrollments !== null ? (
                <div className="text-2xl font-bold">{metrics.enrollments}</div>
              ) : (
                <Skeleton className="h-8 w-12" />
              )}
              <p className="text-xs text-muted-foreground">Total enrollments</p>
            </CardContent>
          </Card>
        )}

        {!isReviewer && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Orders</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {metrics.orders !== null ? (
                <div className="text-2xl font-bold">{metrics.orders}</div>
              ) : (
                <Skeleton className="h-8 w-12" />
              )}
              <p className="text-xs text-muted-foreground">Total orders</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Health Reports</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metrics.reports !== null ? (
              <div className="text-2xl font-bold">{metrics.reports}</div>
            ) : (
              <Skeleton className="h-8 w-12" />
            )}
            <p className="text-xs text-muted-foreground">
              {isReviewer ? 'Reports to review' : 'Total reports'}
            </p>
          </CardContent>
        </Card>

        {!isReviewer && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Content</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {metrics.content !== null ? (
                <div className="text-2xl font-bold">{metrics.content}</div>
              ) : (
                <Skeleton className="h-8 w-12" />
              )}
              <p className="text-xs text-muted-foreground">Published articles</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Notifications</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metrics.unreadNotifications !== null ? (
              <div className="text-2xl font-bold">{metrics.unreadNotifications}</div>
            ) : (
              <Skeleton className="h-8 w-12" />
            )}
            <p className="text-xs text-muted-foreground">Unread notifications</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
