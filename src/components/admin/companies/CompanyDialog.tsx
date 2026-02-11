import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Company } from '@/hooks/hr/useCompanies';
import { useCreateCompany } from '@/hooks/admin/useCreateCompany';
import { useUpdateCompany } from '@/hooks/admin/useUpdateCompany';

const companySchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters')
    .trim(),
  code: z
    .string()
    .min(2, 'Code must be at least 2 characters')
    .max(10, 'Code must not exceed 10 characters')
    .regex(/^[A-Z0-9]+$/i, 'Code must be alphanumeric only')
    .transform((val) => val.toUpperCase()),
  registration_no: z.string().trim().max(50, 'Registration number must not exceed 50 characters').optional().or(z.literal('')),
  address: z.string().trim().max(500, 'Address must not exceed 500 characters').optional().or(z.literal('')),
  phone: z.string().trim().max(20, 'Phone must not exceed 20 characters').optional().or(z.literal('')),
});

type CompanyFormValues = z.infer<typeof companySchema>;

interface CompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company?: Company | null;
}

export function CompanyDialog({ open, onOpenChange, company }: CompanyDialogProps) {
  const createCompany = useCreateCompany();
  const updateCompany = useUpdateCompany();

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: company?.name || '',
      code: company?.code || '',
      registration_no: company?.registration_no || '',
      address: company?.address || '',
      phone: company?.phone || '',
    },
  });

  useEffect(() => {
    if (open && company) {
      form.reset({
        name: company.name,
        code: company.code,
        registration_no: company.registration_no || '',
        address: company.address || '',
        phone: company.phone || '',
      });
    } else if (open && !company) {
      form.reset({
        name: '',
        code: '',
        registration_no: '',
        address: '',
        phone: '',
      });
    }
  }, [company, open, form]);

  const onSubmit = async (data: CompanyFormValues) => {
    if (company) {
      await updateCompany.mutateAsync({
        id: company.id,
        name: data.name,
        code: data.code,
        registration_no: data.registration_no,
        address: data.address,
        phone: data.phone,
      });
    } else {
      await createCompany.mutateAsync({
        name: data.name,
        code: data.code,
        registration_no: data.registration_no,
        address: data.address,
        phone: data.phone,
      });
    }

    onOpenChange(false);
    form.reset();
  };

  const handleClose = () => {
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{company ? 'Edit Company' : 'Create Company'}</DialogTitle>
          <DialogDescription>
            {company
              ? 'Update the company information below.'
              : 'Add a new company to your organization.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Tidal Sdn Bhd" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Code</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., TIDAL"
                      maxLength={10}
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="registration_no"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Registration Number</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 202301234567" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 03-1234 5678" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Enter company address" rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createCompany.isPending || updateCompany.isPending}
              >
                {company ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
