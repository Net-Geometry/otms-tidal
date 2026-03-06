import { useMemo } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

import { FileUpload } from '@/components/ot/FileUpload';
import type { ClaimType } from '@/types/claims';
import { getClaimCyclePeriod } from '@/lib/submissionCycles';

const schema = z.object({
  claim_type_id: z.string().min(1, 'Claim type is required'),
  claim_date: z.string().min(1, 'Receipt date is required'),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  purpose: z.string().max(500).nullable().optional(),
  receipt_urls: z.array(z.string().url('Invalid file URL')).default([]),
});

export type ClaimSubmitFormValues = z.infer<typeof schema>;

export function ClaimSubmitForm({
  claimTypes,
  onSubmit,
  isSubmitting,
}: {
  claimTypes: ClaimType[];
  onSubmit: (values: ClaimSubmitFormValues) => Promise<void> | void;
  isSubmitting?: boolean;
}) {
  const claimTypeById = useMemo(() => {
    const map = new Map<string, ClaimType>();
    for (const ct of claimTypes) map.set(ct.id, ct);
    return map;
  }, [claimTypes]);

  const form = useForm<ClaimSubmitFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      claim_type_id: '',
      claim_date: '',
      amount: 0,
      purpose: null,
      receipt_urls: [],
    },
  });

  const watched = form.watch();
  const selectedType = watched.claim_type_id ? claimTypeById.get(watched.claim_type_id) : undefined;

  const cycleHint = useMemo(() => {
    if (!watched.claim_date) return null;
    const cycle = getClaimCyclePeriod(watched.claim_date);
    return `Submit by ${cycle.end} for this claim period`;
  }, [watched.claim_date]);

  const limitHint = useMemo(() => {
    if (!selectedType) return null;
    if (selectedType.limit_amount == null) return null;
    const period = selectedType.limit_period || 'period';
    return `Soft limit: RM${Number(selectedType.limit_amount).toFixed(2)}/${period}`;
  }, [selectedType]);

  const handleSubmit = async (values: ClaimSubmitFormValues) => {
    const ct = claimTypeById.get(values.claim_type_id);
    if (!ct) {
      form.setError('claim_type_id', { message: 'Invalid claim type' });
      return;
    }

    await onSubmit(values);
    form.reset();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Claim</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="claim_type_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Claim Type *</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select claim type" />
                      </SelectTrigger>
                      <SelectContent>
                        {claimTypes.map((ct) => (
                          <SelectItem key={ct.id} value={ct.id}>
                            {ct.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  {limitHint && <div className="text-xs text-muted-foreground">{limitHint}</div>}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="claim_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Receipt Date *</FormLabel>
                    <FormControl>
                      <Input type="date" value={field.value} onChange={field.onChange} disabled={isSubmitting} />
                    </FormControl>
                    {cycleHint && <div className="text-xs text-muted-foreground">{cycleHint}</div>}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (RM) *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purpose</FormLabel>
                  <FormControl>
                    <Textarea
                      value={field.value || ''}
                      onChange={field.onChange}
                      placeholder="Optional"
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {(selectedType?.requires_attachment !== false) && (
              <FormField
                control={form.control}
                name="receipt_urls"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Receipts</FormLabel>
                    <FormControl>
                      <FileUpload
                        bucket="claim-attachments"
                        onUploadComplete={(urls) => field.onChange(urls)}
                        onRemove={(index) => {
                          const cur = field.value || [];
                          field.onChange(cur.filter((_, i) => i !== index));
                        }}
                        currentFiles={field.value || []}
                        maxFiles={5}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex justify-end gap-2">
              <Button type="submit" disabled={!!isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Claim'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
