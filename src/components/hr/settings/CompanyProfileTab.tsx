import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { RotateCcw, Save, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CompanyLogoUpload } from './CompanyLogoUpload';
import { useCompanyProfile } from '@/hooks/hr/useCompanyProfile';
import { useUpdateCompanyProfile, uploadCompanyLogo, deleteCompanyLogo } from '@/hooks/hr/useUpdateCompanyProfile';
import { HolidayConfigService } from '@/services/HolidayConfigService';
import { getAllStates, getStateLabel } from '@/config/malaysia-states';
import { toast } from 'sonner';

const configService = new HolidayConfigService();

const companyProfileSchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  registration_no: z.string().min(1, 'Registration number is required'),
  address: z.string().min(1, 'Address is required'),
  phone: z.string().min(1, 'Phone is required')
});

type CompanyProfileForm = z.infer<typeof companyProfileSchema>;

export function CompanyProfileTab() {
  const { data: company, isLoading } = useCompanyProfile();
  const updateProfile = useUpdateCompanyProfile();
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [companyState, setCompanyState] = useState<string | null>(null);
  const [isLoadingState, setIsLoadingState] = useState(true);
  const [isSavingState, setIsSavingState] = useState(false);

  // Load company state on mount
  useEffect(() => {
    const loadCompanyState = async () => {
      try {
        const state = await configService.getCompanyState();
        setCompanyState(state);
      } catch (error) {
        console.error('Error loading company state:', error);
      } finally {
        setIsLoadingState(false);
      }
    };
    loadCompanyState();
  }, []);

  const handleStateChange = async (value: string) => {
    setIsSavingState(true);
    try {
      await configService.saveCompanyState(value);
      setCompanyState(value);
      toast.success('Company state updated', {
        description: `State set to ${getStateLabel(value)}`
      });
    } catch (error) {
      console.error('Error saving company state:', error);
      toast.error('Failed to update company state');
    } finally {
      setIsSavingState(false);
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<CompanyProfileForm>({
    resolver: zodResolver(companyProfileSchema),
    values: company ? {
      name: company.name,
      registration_no: company.registration_no,
      address: company.address,
      phone: company.phone
    } : undefined
  });

  const handleLogoUpload = async (file: File) => {
    setIsUploadingLogo(true);
    try {
      const newLogoUrl = await uploadCompanyLogo(file);
      
      // Delete old logo if exists
      if (company?.logo_url) {
        await deleteCompanyLogo(company.logo_url);
      }

      await updateProfile.mutateAsync({ logo_url: newLogoUrl });
      toast.success('Logo uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload logo');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleResetLogo = async () => {
    if (!company?.logo_url) return;

    try {
      await deleteCompanyLogo(company.logo_url);
      await updateProfile.mutateAsync({ logo_url: null });
      toast.success('Logo removed');
    } catch (error) {
      console.error('Reset error:', error);
      toast.error('Failed to remove logo');
    }
  };

  const onSubmit = async (data: CompanyProfileForm) => {
    await updateProfile.mutateAsync(data);
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(word => word.length > 0 && word !== '&')
      .slice(0, 3)
      .map(word => word[0].toUpperCase())
      .join('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Company Branding Settings</h3>
        <p className="text-sm text-muted-foreground">
          Upload or change your company logo. The logo will be applied across the system and in all exported reports.
        </p>
      </div>

      {/* Logo Preview */}
      <div className="space-y-3">
        <Label>Current Company Logo</Label>
        <div className="flex items-center gap-4">
          {company?.logo_url ? (
            <img
              src={company.logo_url}
              alt="Company Logo"
              className="w-[120px] h-[120px] rounded-xl border border-border object-contain bg-muted"
            />
          ) : (
            <div className="w-[120px] h-[120px] rounded-xl border border-border bg-muted flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">
                {company?.name ? getInitials(company.name) : 'CO'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Logo Upload */}
      <div className="space-y-3">
        <Label>Upload New Logo</Label>
        <CompanyLogoUpload onFileSelect={handleLogoUpload} isUploading={isUploadingLogo} />
        {company?.logo_url && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetLogo}
            disabled={updateProfile.isPending}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Default Logo
          </Button>
        )}
      </div>

      {/* Company State Selection */}
      <div className="space-y-3 pt-6 border-t">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Company Location
          </h3>
          <p className="text-sm text-muted-foreground">
            Select your company's primary Malaysian state. This determines which state holidays apply to your company calendar.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="company-state">Malaysian State</Label>
          <Select
            value={companyState || undefined}
            onValueChange={handleStateChange}
            disabled={isLoadingState || isSavingState}
          >
            <SelectTrigger id="company-state" className="w-full max-w-md">
              <SelectValue placeholder={isLoadingState ? "Loading..." : "Select company state"} />
            </SelectTrigger>
            <SelectContent>
              {getAllStates().map((state) => (
                <SelectItem key={state.value} value={state.value}>
                  <div className="flex items-center gap-2">
                    <span>{state.label}</span>
                    <Badge variant="outline" className="text-xs">
                      {state.value}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {companyState && (
            <p className="text-xs text-muted-foreground">
              Current state: <span className="font-semibold">{getStateLabel(companyState)}</span> ({companyState})
            </p>
          )}
        </div>
      </div>

      {/* Company Details Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-6 border-t">
        <div className="space-y-2">
          <Label htmlFor="name">Company Name</Label>
          <Input
            id="name"
            {...register('name')}
            placeholder="Enter company name"
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="registration_no">Registration Number</Label>
          <Input
            id="registration_no"
            {...register('registration_no')}
            placeholder="Enter registration number"
          />
          {errors.registration_no && (
            <p className="text-sm text-destructive">{errors.registration_no.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          <Textarea
            id="address"
            {...register('address')}
            placeholder="Enter company address"
            rows={3}
          />
          {errors.address && (
            <p className="text-sm text-destructive">{errors.address.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            {...register('phone')}
            placeholder="Enter phone number"
          />
          {errors.phone && (
            <p className="text-sm text-destructive">{errors.phone.message}</p>
          )}
        </div>

        <Button type="submit" disabled={updateProfile.isPending}>
          <Save className="h-4 w-4 mr-2" />
          {updateProfile.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </form>
    </div>
  );
}
