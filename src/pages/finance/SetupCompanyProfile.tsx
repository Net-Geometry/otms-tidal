import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Lock } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useAuth } from '@/hooks/useAuth';
import { useCompanies } from '@/hooks/hr/useCompanies';
import { useFinanceCompanyProfiles, useBankAccounts } from '@/hooks/finance/useFinanceFoundation';
import { useChartOfAccounts } from '@/hooks/finance/useChartOfAccounts';

const monthOptions = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const schema = z.object({
  base_currency: z.string().min(3, 'Currency is required').max(3, 'Use 3-letter code').transform((value) => value.toUpperCase()),
  fiscal_year_start_month: z.coerce.number().min(1).max(12),
  payment_terms_days: z.coerce.number().min(0, 'Must be 0 or above'),
  tax_id: z.string().optional().nullable(),
  sst_registration_no: z.string().optional().nullable(),
  lock_date: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  decimal_precision: z.coerce.number().min(0).max(6),
  default_bank_account_id: z.string().optional().nullable(),
  retained_earnings_gl_id: z.string().optional().nullable(),
  suspense_account_gl_id: z.string().optional().nullable(),
  address_line1: z.string().optional().nullable(),
  address_line2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  postcode: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
});

type Values = z.infer<typeof schema>;

export default function SetupCompanyProfile() {
  const { profile } = useAuth();
  const { data: companies = [] } = useCompanies();
  const profiles = useFinanceCompanyProfiles();
  const { bankAccounts } = useBankAccounts();
  const { accounts: glAccounts } = useChartOfAccounts();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      base_currency: 'MYR',
      fiscal_year_start_month: 1,
      payment_terms_days: 30,
      tax_id: '',
      sst_registration_no: '',
      lock_date: '',
      notes: '',
      decimal_precision: 2,
      default_bank_account_id: '',
      retained_earnings_gl_id: '',
      suspense_account_gl_id: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postcode: '',
      country: 'Malaysia',
      phone: '',
      email: '',
      website: '',
    },
  });

  useEffect(() => {
    if (selectedCompanyId) return;

    if (profile?.company_id) {
      const profileCompanyExists = companies.some((company) => company.id === profile.company_id);
      if (profileCompanyExists) {
        setSelectedCompanyId(profile.company_id);
        return;
      }
    }

    if (companies.length > 0) {
      setSelectedCompanyId(companies[0].id);
    }
  }, [selectedCompanyId, companies, profile?.company_id]);

  const selectedCompany = useMemo(() => {
    if (!selectedCompanyId) return null;
    return companies.find((company) => company.id === selectedCompanyId) || null;
  }, [companies, selectedCompanyId]);

  const selectedProfile = useMemo(() => {
    if (!selectedCompanyId) return null;
    return profiles.profiles.find((row) => row.company_id === selectedCompanyId) || null;
  }, [profiles.profiles, selectedCompanyId]);

  useEffect(() => {
    if (!selectedCompanyId) return;

    form.reset({
      base_currency: selectedProfile?.base_currency || 'MYR',
      fiscal_year_start_month: Number(selectedProfile?.fiscal_year_start_month || 1),
      payment_terms_days: Number(selectedProfile?.payment_terms_days || 30),
      tax_id: selectedProfile?.tax_id || '',
      sst_registration_no: selectedProfile?.sst_registration_no || '',
      lock_date: selectedProfile?.lock_date || '',
      notes: selectedProfile?.notes || '',
      decimal_precision: Number(selectedProfile?.decimal_precision ?? 2),
      default_bank_account_id: selectedProfile?.default_bank_account_id || '',
      retained_earnings_gl_id: selectedProfile?.retained_earnings_gl_id || '',
      suspense_account_gl_id: selectedProfile?.suspense_account_gl_id || '',
      address_line1: selectedProfile?.address_line1 || '',
      address_line2: selectedProfile?.address_line2 || '',
      city: selectedProfile?.city || '',
      state: selectedProfile?.state || '',
      postcode: selectedProfile?.postcode || '',
      country: selectedProfile?.country || 'Malaysia',
      phone: selectedProfile?.phone || '',
      email: selectedProfile?.email || '',
      website: selectedProfile?.website || '',
    });
  }, [form, selectedCompanyId, selectedProfile]);

  const submit = async (values: Values) => {
    if (!selectedCompanyId) return;

    await profiles.upsertProfile({
      id: selectedProfile?.id,
      company_id: selectedCompanyId,
      base_currency: values.base_currency,
      fiscal_year_start_month: Number(values.fiscal_year_start_month),
      payment_terms_days: Number(values.payment_terms_days),
      tax_id: values.tax_id?.trim() || null,
      sst_registration_no: values.sst_registration_no?.trim() || null,
      lock_date: values.lock_date || null,
      notes: values.notes?.trim() || null,
      decimal_precision: Number(values.decimal_precision ?? 2),
      default_bank_account_id: values.default_bank_account_id || null,
      retained_earnings_gl_id: values.retained_earnings_gl_id || null,
      suspense_account_gl_id: values.suspense_account_gl_id || null,
      address_line1: values.address_line1?.trim() || null,
      address_line2: values.address_line2?.trim() || null,
      city: values.city?.trim() || null,
      state: values.state?.trim() || null,
      postcode: values.postcode?.trim() || null,
      country: values.country?.trim() || null,
      phone: values.phone?.trim() || null,
      email: values.email?.trim() || null,
      website: values.website?.trim() || null,
    });
  };

  return (
    <AppLayout>
      <PageLayout title="Company Profile" description="Configure finance defaults by company: base currency, fiscal year, lock date, and tax references.">
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Company Setup Context</CardTitle>
                <CardDescription>This finance profile setup is scoped to your assigned company.</CardDescription>
              </div>
              <Badge variant="outline" className="gap-1.5">
                <Lock className="h-3.5 w-3.5" />
                Fixed Scope
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background p-5">
              <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
              <div className="absolute -bottom-12 -left-12 h-28 w-28 rounded-full bg-secondary/30 blur-2xl" />
              <div className="relative space-y-3">
                <Badge variant="secondary" className="w-fit gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  Assigned Company
                </Badge>

                <p className="text-sm text-muted-foreground">You are managing</p>
                <p className="text-2xl font-semibold tracking-tight">
                  {selectedCompany?.name || 'your assigned company'}
                  <span className="ml-2 text-base font-medium text-muted-foreground">profile</span>
                </p>

                <div className="flex flex-wrap gap-2 pt-1">
                  {selectedCompany?.code ? (
                    <Badge variant="outline" className="font-mono">
                      {selectedCompany.code}
                    </Badge>
                  ) : null}
                  <Badge variant="outline">Finance profile is locked to this company</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Finance Defaults</CardTitle>
            <CardDescription>These values are applied as defaults across AP, AR, and GL transactions.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="base_currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Base Currency</FormLabel>
                        <FormControl>
                          <Input maxLength={3} placeholder="MYR" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="fiscal_year_start_month"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fiscal Year Starts</FormLabel>
                        <Select value={String(field.value)} onValueChange={(value) => field.onChange(Number(value))}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {monthOptions.map((month) => (
                              <SelectItem key={month.value} value={String(month.value)}>
                                {month.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="payment_terms_days"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Payment Terms (Days)</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="tax_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tax ID</FormLabel>
                        <FormControl>
                          <Input placeholder="Company tax identifier" value={field.value || ''} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sst_registration_no"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SST Registration No.</FormLabel>
                        <FormControl>
                          <Input placeholder="SST-XXXX" value={field.value || ''} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lock_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Posting Lock Date</FormLabel>
                        <FormControl>
                          <Input type="date" value={field.value || ''} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* GL Account Defaults */}
                <div className="pt-4 border-t">
                  <h3 className="text-sm font-medium mb-3">GL Account Defaults</h3>
                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="decimal_precision"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Decimal Precision</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" max="6" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="retained_earnings_gl_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Retained Earnings GL</FormLabel>
                          <Select value={field.value || '__none__'} onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select equity account" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__none__">-- None --</SelectItem>
                              {glAccounts
                                .filter((a) => a.account_type === 'equity' && a.is_postable && a.is_active)
                                .map((a) => (
                                  <SelectItem key={a.id} value={a.id}>
                                    {a.account_code} - {a.account_name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="suspense_account_gl_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Suspense Account GL</FormLabel>
                          <Select value={field.value || '__none__'} onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select account" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__none__">-- None --</SelectItem>
                              {glAccounts
                                .filter((a) => a.is_postable && a.is_active)
                                .map((a) => (
                                  <SelectItem key={a.id} value={a.id}>
                                    {a.account_code} - {a.account_name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Banking */}
                <div className="pt-4 border-t">
                  <h3 className="text-sm font-medium mb-3">Banking</h3>
                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="default_bank_account_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Default Bank Account</FormLabel>
                          <Select value={field.value || '__none__'} onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select bank account" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__none__">-- None --</SelectItem>
                              {bankAccounts.map((ba) => (
                                <SelectItem key={ba.id} value={ba.id}>
                                  {ba.account_code} - {ba.account_name} ({ba.bank_name})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Company Address */}
                <div className="pt-4 border-t">
                  <h3 className="text-sm font-medium mb-3">Company Address</h3>
                  <div className="grid gap-4">
                    <FormField
                      control={form.control}
                      name="address_line1"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address Line 1</FormLabel>
                          <FormControl>
                            <Input placeholder="Street address" value={field.value || ''} onChange={field.onChange} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address_line2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address Line 2</FormLabel>
                          <FormControl>
                            <Input placeholder="Suite, floor, etc." value={field.value || ''} onChange={field.onChange} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid gap-4 md:grid-cols-3">
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City</FormLabel>
                            <FormControl>
                              <Input placeholder="City" value={field.value || ''} onChange={field.onChange} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State</FormLabel>
                            <FormControl>
                              <Input placeholder="State" value={field.value || ''} onChange={field.onChange} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="postcode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Postcode</FormLabel>
                            <FormControl>
                              <Input placeholder="Postcode" value={field.value || ''} onChange={field.onChange} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <FormField
                        control={form.control}
                        name="country"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Country</FormLabel>
                            <FormControl>
                              <Input placeholder="Country" value={field.value || ''} onChange={field.onChange} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="pt-4 border-t">
                  <h3 className="text-sm font-medium mb-3">Contact Information</h3>
                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="+60 3-XXXX XXXX" value={field.value || ''} onChange={field.onChange} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="finance@company.com" value={field.value || ''} onChange={field.onChange} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="website"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website</FormLabel>
                          <FormControl>
                            <Input placeholder="https://www.company.com" value={field.value || ''} onChange={field.onChange} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Internal finance notes and policy remarks"
                          value={field.value || ''}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end">
                  <Button type="submit" disabled={!selectedCompanyId || profiles.isSaving}>
                    {profiles.isSaving ? 'Saving...' : 'Save Profile'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </PageLayout>
    </AppLayout>
  );
}
