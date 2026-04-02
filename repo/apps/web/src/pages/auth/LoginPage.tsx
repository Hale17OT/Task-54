import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { riskApi } from '@/api/risk.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Heart, Loader2, AlertCircle, ShieldAlert } from 'lucide-react';

export function LoginPage() {
  const { login, isAuthenticated, isLoading, error, captchaRequired, clearError } = useAuthStore();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // CAPTCHA state
  const [captchaId, setCaptchaId] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaImage, setCaptchaImage] = useState('');
  const [loadingCaptcha, setLoadingCaptcha] = useState(false);

  const fetchCaptcha = async () => {
    setLoadingCaptcha(true);
    try {
      const res = await riskApi.getCaptcha();
      setCaptchaId(res.data.id);
      setCaptchaImage(res.data.imageBase64);
      setCaptchaAnswer('');
    } catch (err) {
      useAuthStore.getState().clearError();
      useAuthStore.setState({ error: 'Could not load security challenge. Please try again.' });
    } finally {
      setLoadingCaptcha(false);
    }
  };

  // Auto-fetch CAPTCHA when server requires it
  useEffect(() => {
    if (captchaRequired && !captchaId) {
      fetchCaptcha();
    }
  }, [captchaRequired]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await login(username, password, captchaId || undefined, captchaAnswer || undefined);
      navigate('/');
    } catch {
      // Error set in store; CAPTCHA auto-fetched via useEffect if required
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Heart className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome to CHECC</CardTitle>
          <CardDescription>
            Community Health Enrollment & Clinic Commerce
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
                autoComplete="username"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                disabled={isLoading}
              />
            </div>

            {captchaRequired && (
              <div className="space-y-3 rounded-md border border-yellow-300 bg-yellow-50 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-yellow-800">
                  <ShieldAlert className="h-4 w-4" />
                  Security verification required
                </div>
                {captchaImage ? (
                  <div className="space-y-2">
                    <div className="rounded border bg-white p-2 font-mono text-center text-sm whitespace-pre">
                      {atob(captchaImage)}
                    </div>
                    <Label htmlFor="captcha">Enter the answer</Label>
                    <Input
                      id="captcha"
                      value={captchaAnswer}
                      onChange={(e) => setCaptchaAnswer(e.target.value)}
                      placeholder="Your answer"
                      required
                      disabled={isLoading}
                    />
                    <Button type="button" variant="ghost" size="sm" onClick={fetchCaptcha} disabled={loadingCaptcha}>
                      {loadingCaptcha ? 'Loading...' : 'New challenge'}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-yellow-700">Loading challenge...</p>
                )}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading || (captchaRequired && !captchaAnswer)}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
