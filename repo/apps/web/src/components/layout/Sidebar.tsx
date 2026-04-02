import { NavLink } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@checc/shared/constants/roles';
import { Separator } from '@/components/ui/separator';
import {
  LayoutDashboard,
  ClipboardList,
  ShoppingCart,
  Heart,
  CreditCard,
  Bell,
  BookOpen,
  Shield,
  Tag,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard, roles: [UserRole.PATIENT, UserRole.STAFF, UserRole.ADMIN, UserRole.REVIEWER] },
  { label: 'Enrollments', path: '/enrollments', icon: ClipboardList, roles: [UserRole.PATIENT, UserRole.STAFF, UserRole.ADMIN] },
  { label: 'Orders', path: '/orders/history', icon: ShoppingCart, roles: [UserRole.PATIENT, UserRole.STAFF, UserRole.ADMIN] },
  { label: 'Health Reports', path: '/reports', icon: Heart, roles: [UserRole.PATIENT, UserRole.STAFF, UserRole.ADMIN, UserRole.REVIEWER] },
  { label: 'Payments', path: '/payments/history', icon: CreditCard, roles: [UserRole.STAFF, UserRole.ADMIN] },
  { label: 'Notifications', path: '/notifications', icon: Bell, roles: [UserRole.PATIENT, UserRole.STAFF, UserRole.ADMIN, UserRole.REVIEWER] },
  { label: 'Content', path: '/content', icon: BookOpen, roles: [UserRole.PATIENT, UserRole.STAFF, UserRole.ADMIN] },
];

const adminItems: NavItem[] = [
  { label: 'Pricing Rules', path: '/admin/pricing', icon: Tag, roles: [UserRole.ADMIN] },
  { label: 'Risk Dashboard', path: '/admin/risk', icon: Shield, roles: [UserRole.ADMIN] },
];

function SidebarLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isActive ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground',
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      {item.label}
    </NavLink>
  );
}

export function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role as UserRole | undefined;

  const filteredNav = navItems.filter((item) => role && item.roles.includes(role));
  const filteredAdmin = adminItems.filter((item) => role && item.roles.includes(role));

  return (
    <aside className="flex w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center border-b px-4">
        <Heart className="mr-2 h-6 w-6 text-primary" />
        <span className="text-lg font-bold">CHECC</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {filteredNav.map((item) => (
          <SidebarLink key={item.path} item={item} />
        ))}
        {filteredAdmin.length > 0 && (
          <>
            <Separator className="my-3" />
            <p className="px-3 text-xs font-semibold uppercase text-muted-foreground tracking-wider">
              Administration
            </p>
            {filteredAdmin.map((item) => (
              <SidebarLink key={item.path} item={item} />
            ))}
          </>
        )}
      </nav>
    </aside>
  );
}
