import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { TEMP_PASSWORD, PASSWORD_REQUIREMENTS } from '@/constants/auth';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second between retries

export default function SetupPassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const checkStatus = async () => {
      if (!user) {
        navigate('/auth');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', user.id)
        .single();

      if (profile?.status === 'active') {
        toast.info('Your password is already set up');
        navigate('/auth');
      }
    };

    checkStatus();
  }, [user, navigate]);

  // Verify profile status was actually updated
  const verifyProfileUpdate = async (maxAttempts = 5): Promise<boolean> => {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 200 * (i + 1))); // Progressive delay

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', user!.id)
        .single();

      if (error) {
        continue;
      }

      if (profile?.status === 'active') {
        return true;
      }
    }
    return false;
  };

  const handleSetupPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      toast.error('Passwords do not match');
      return;
    }

    if (newPassword.length < PASSWORD_REQUIREMENTS.minLength) {
      setError(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`);
      toast.error(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`);
      return;
    }

    if (newPassword === TEMP_PASSWORD) {
      setError('You cannot use the temporary password as your new password');
      toast.error('You cannot use the temporary password as your new password');
      return;
    }

    setLoading(true);

    try {
      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      // Update profile status to active
      const { error: profileError, data } = await supabase
        .from('profiles')
        .update({ status: 'active' })
        .eq('id', user!.id)
        .select();

      if (profileError) {
        throw new Error(`Failed to update account status: ${profileError.message}`);
      }

      // Verify the update actually succeeded (catch silent RLS policy failures)
      if (!data || data.length === 0) {
        throw new Error('Profile update returned no data. Verifying changes...');
      }

      // Verify the profile status was actually updated in the database
      const updateVerified = await verifyProfileUpdate();
      if (!updateVerified) {
        throw new Error('Profile status update could not be verified. Please try again.');
      }

      toast.success('Password successfully set. Please log in with your new password.');

      // Sign out the user
      await supabase.auth.signOut();

      setTimeout(() => {
        navigate('/auth');
      }, 1500);
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to set password';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setError(null);
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Set Up Your Password</CardTitle>
          <CardDescription>
            You are required to set your password before using the system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSetupPassword} className="space-y-4">
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 text-sm text-destructive">
                <p className="font-medium">Error: {error}</p>
                {retryCount < MAX_RETRIES && (
                  <p className="text-xs mt-1 text-destructive/80">
                    Attempt {retryCount + 1} of {MAX_RETRIES}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email (Read-only)</Label>
              <Input
                id="email"
                type="email"
                value={user?.email || ''}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={loading}
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">
                Minimum 8 characters
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={loading || retryCount >= MAX_RETRIES}>
                {loading ? 'Setting Password...' : 'Save Password'}
              </Button>
              {error && retryCount < MAX_RETRIES && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRetry}
                  disabled={loading}
                >
                  Retry
                </Button>
              )}
            </div>

            {retryCount >= MAX_RETRIES && error && (
              <p className="text-xs text-center text-destructive">
                Maximum retry attempts reached. Please contact your administrator.
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
