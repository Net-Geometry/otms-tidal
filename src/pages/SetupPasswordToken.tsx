import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function SetupPassword() {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const customToken = searchParams.get('custom_token');

  useEffect(() => {
    const validateToken = async () => {
      if (!customToken) {
        toast({
          title: 'Invalid Link',
          description: 'This activation link is invalid or missing required parameters.',
          variant: 'destructive',
        });
        setValidating(false);
        return;
      }

      try {
        // Validate token against activation_tokens table
        const { data, error } = await supabase
          .from('activation_tokens')
          .select('id, status, expires_at')
          .eq('token', customToken)
          .eq('status', 'pending')
          .single();

        if (error || !data) {
          toast({
            title: 'Invalid Token',
            description: 'This activation link is invalid or has already been used.',
            variant: 'destructive',
          });
          setTokenValid(false);
        } else if (new Date(data.expires_at) < new Date()) {
          toast({
            title: 'Expired Link',
            description: 'This activation link has expired. Please request a new one from your HR.',
            variant: 'destructive',
          });
          setTokenValid(false);
        } else {
          setTokenValid(true);
        }
      } catch (error) {
        console.error('Token validation error:', error);
        toast({
          title: 'Error',
          description: 'Failed to validate activation link.',
          variant: 'destructive',
        });
        setTokenValid(false);
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [customToken, toast]);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'destructive',
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: 'Error',
        description: 'Password must be at least 8 characters long',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Call activate-account edge function
      const { data, error } = await supabase.functions.invoke('activate-account', {
        body: { token: customToken, password },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Success',
          description: 'Your account has been activated! Please sign in.',
        });
        navigate('/auth');
      } else {
        throw new Error(data.error || 'Failed to activate account');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to set password',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Validating activation link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid Activation Link</CardTitle>
            <CardDescription>
              This activation link is invalid, expired, or has already been used.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/auth')} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set Your Password</CardTitle>
          <CardDescription>
            Welcome to Tidal Portal! Please create a secure password for your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">
                Must be at least 8 characters long
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                minLength={8}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Setting Password...' : 'Activate Account'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
