import { useAuthStore } from '@/stores/auth.store';
import type { UserRole } from '@checc/shared/constants/roles';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RoleGateProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}

export function RoleGate({ allowedRoles, children }: RoleGateProps) {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  if (!user || !allowedRoles.includes(user.role)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <ShieldX className="h-12 w-12 mx-auto text-destructive opacity-60" />
            <h2 className="text-xl font-semibold">Access Denied</h2>
            <p className="text-sm text-muted-foreground">
              You don't have permission to access this page.
              {user && <span> Your role (<strong>{user.role}</strong>) does not have the required access level.</span>}
            </p>
            <Button variant="outline" onClick={() => navigate('/')}>
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
