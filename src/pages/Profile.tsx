import { useAuth } from '@/hooks/useAuth';
import { PageLayout } from '@/components/ui/page-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Briefcase, MapPin, DollarSign, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { InventoryQRCodeCard } from '@/components/profile/InventoryQRCodeCard';

export default function Profile() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const formatCurrency = (amount: number | null | undefined) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: 'MYR',
    }).format(amount);
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return 'N/A';
    try {
      return format(new Date(date), 'dd MMM yyyy');
    } catch {
      return 'N/A';
    }
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  return (
    <PageLayout
      title="My Profile"
      description="View your account information"
      onBack={() => navigate(-1)}
    >

      <div className="grid gap-6 md:grid-cols-2">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle>Personal Information</CardTitle>
            </div>
            <CardDescription>Your personal details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Full Name</label>
              <p className="text-base mt-1">{profile.full_name || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Employee ID</label>
              <p className="text-base mt-1">{profile.employee_id || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Email Address</label>
              <p className="text-base mt-1">{profile.email || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">IC Number</label>
              <p className="text-base mt-1">{profile.ic_no || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Phone Number</label>
              <p className="text-base mt-1">{profile.phone_no || 'N/A'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Employment Details */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              <CardTitle>Employment Details</CardTitle>
            </div>
            <CardDescription>Your work information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Department</label>
              <p className="text-base mt-1">{profile.department?.name || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Position</label>
              <p className="text-base mt-1">{profile.position_obj?.title || profile.position || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Designation</label>
              <p className="text-base mt-1">{profile.designation || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Employment Type</label>
              <p className="text-base mt-1">{profile.employment_type || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Joining Date</label>
              <p className="text-base mt-1">{formatDate(profile.joining_date)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Work Location */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <CardTitle>Work Location</CardTitle>
            </div>
            <CardDescription>Your workplace details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Work Location</label>
              <p className="text-base mt-1">{profile.work_location || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">State</label>
              <p className="text-base mt-1">{profile.state || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">OT Eligibility</label>
              <div className="mt-1">
                <Badge variant={profile.is_ot_eligible ? 'default' : 'secondary'}>
                  {profile.is_ot_eligible ? 'Eligible' : 'Not Eligible'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Salary & Account Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <CardTitle>Salary & Account</CardTitle>
            </div>
            <CardDescription>Compensation and account status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Basic Salary</label>
              <p className="text-base mt-1 font-semibold">{formatCurrency(profile.basic_salary)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">EPF Number</label>
              <p className="text-base mt-1">{profile.epf_no || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">SOCSO Number</label>
              <p className="text-base mt-1">{profile.socso_no || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Income Tax Number</label>
              <p className="text-base mt-1">{profile.income_tax_no || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Account Status</label>
              <div className="mt-1">
                <Badge variant={profile.status === 'active' ? 'default' : 'secondary'}>
                  {profile.status || 'N/A'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User Roles */}
        {profile.user_roles && profile.user_roles.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <CardTitle>User Roles</CardTitle>
              </div>
              <CardDescription>Your assigned roles in the system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {profile.user_roles.map((userRole, index) => (
                  <Badge key={index} variant="outline" className="text-sm">
                    {userRole.role.toUpperCase()}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Inventory Room Access QR Code */}
        <InventoryQRCodeCard profile={profile} />
      </div>
    </PageLayout>
  );
}
