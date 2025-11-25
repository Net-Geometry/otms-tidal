import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function ResetPassword() {
  const [resetCode, setResetCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!resetCode.trim()) {
      toast.error('Please enter your reset code');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      // Call the use-password-reset-token function
      const { data, error } = await supabase.functions.invoke('use-password-reset-token', {
        body: {
          token: resetCode.toUpperCase(),
          newPassword: password,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to reset password');
      }

      toast.success('Password reset successfully!');
      navigate('/auth');
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Reset Your Password</CardTitle>
          <CardDescription>
            Enter your reset code and create a new password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-4">
            {/* Reset Code Input */}
            <div className="space-y-2">
              <Label htmlFor="resetCode">Reset Code</Label>
              <Input
                id="resetCode"
                type="text"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value.toUpperCase())}
                placeholder="e.g. A7K9M2X5"
                required
                disabled={loading}
                className="font-mono text-center text-lg tracking-widest"
              />
              <p className="text-xs text-muted-foreground">
                Enter the 8-character code you received from your HR department
              </p>
            </div>

            {/* New Password Input */}
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">
                Minimum 8 characters
              </p>
            </div>

            {/* Confirm Password Input */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Your reset code will expire in 48 hours. If your code has expired, ask your HR department for a new one.
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Resetting Password...' : 'Reset Password'}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            Remember your password?{' '}
            <Button
              variant="link"
              className="p-0 h-auto"
              onClick={() => navigate('/auth')}
            >
              Sign In
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
