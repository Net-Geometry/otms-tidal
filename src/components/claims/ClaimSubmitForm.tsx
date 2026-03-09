import { useMemo, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import {
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Receipt,
  FileText,
} from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

import { FileUpload } from '@/components/ot/FileUpload';
import type { ClaimType } from '@/types/claims';
import { getClaimCyclePeriod } from '@/lib/submissionCycles';

const itemSchema = z.object({
  claim_type_id: z.string().min(1, 'Claim type is required'),
  claim_date: z.string().min(1, 'Receipt date is required'),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  purpose: z.string().max(500).nullable().optional(),
  receipt_urls: z.array(z.string().url('Invalid file URL')).default([]),
});

const schema = z.object({
  items: z.array(itemSchema).min(1, 'At least one claim item is required'),
});

export type ClaimSubmitItemValues = z.infer<typeof itemSchema>;
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
      items: [
        {
          claim_type_id: '',
          claim_date: '',
          amount: 0,
          purpose: null,
          receipt_urls: [],
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const watched = form.watch();

  const handleSubmit = async (values: ClaimSubmitFormValues) => {
    for (let i = 0; i < values.items.length; i++) {
      const ct = claimTypeById.get(values.items[i].claim_type_id);
      if (!ct) {
        form.setError(`items.${i}.claim_type_id`, {
          message: 'Invalid claim type',
        });
        return;
      }
    }

    await onSubmit(values);
    form.reset();
  };

  const totalAmount = useMemo(() => {
    return (watched.items || []).reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0,
    );
  }, [watched.items]);

  const itemCount = fields.length;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Receipt className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold leading-tight">
                New Claim
              </h3>
              <p className="text-xs text-muted-foreground">
                {itemCount === 1
                  ? 'Add receipts for reimbursement'
                  : `${itemCount} items added`}
              </p>
            </div>
          </div>
          {itemCount > 1 && (
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-lg font-semibold tabular-nums tracking-tight">
                RM{totalAmount.toFixed(2)}
              </div>
            </div>
          )}
        </div>

        {/* Claim items */}
        <div className="space-y-3">
          {fields.map((field, index) => (
            <ClaimItemCard
              key={field.id}
              index={index}
              form={form}
              claimTypes={claimTypes}
              claimTypeById={claimTypeById}
              isSubmitting={!!isSubmitting}
              canRemove={itemCount > 1}
              onRemove={() => remove(index)}
              watchedItem={watched.items?.[index]}
              defaultOpen={index === itemCount - 1}
            />
          ))}
        </div>

        {/* Add item button */}
        <button
          type="button"
          disabled={!!isSubmitting}
          className="group flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/20 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary disabled:pointer-events-none disabled:opacity-50"
          onClick={() =>
            append({
              claim_type_id: '',
              claim_date: '',
              amount: 0,
              purpose: null,
              receipt_urls: [],
            })
          }
        >
          <Plus className="h-4 w-4 transition-transform group-hover:scale-110" />
          Add another item
        </button>

        {/* Submit footer */}
        <Card className="border-0 bg-muted/50">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-baseline gap-3">
              <span className="text-sm text-muted-foreground">
                {itemCount} {itemCount === 1 ? 'claim' : 'claims'}
              </span>
              {totalAmount > 0 && (
                <span className="text-base font-semibold tabular-nums">
                  RM{totalAmount.toFixed(2)}
                </span>
              )}
            </div>
            <Button type="submit" disabled={!!isSubmitting} size="lg">
              {isSubmitting
                ? 'Submitting...'
                : itemCount > 1
                  ? `Submit ${itemCount} Claims`
                  : 'Submit Claim'}
            </Button>
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}

/* ------------------------------------------------------------------ */

function ClaimItemCard({
  index,
  form,
  claimTypes,
  claimTypeById,
  isSubmitting,
  canRemove,
  onRemove,
  watchedItem,
  defaultOpen,
}: {
  index: number;
  form: ReturnType<typeof useForm<ClaimSubmitFormValues>>;
  claimTypes: ClaimType[];
  claimTypeById: Map<string, ClaimType>;
  isSubmitting: boolean;
  canRemove: boolean;
  onRemove: () => void;
  watchedItem?: ClaimSubmitItemValues;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? true);

  const selectedType = watchedItem?.claim_type_id
    ? claimTypeById.get(watchedItem.claim_type_id)
    : undefined;

  const cycleHint = useMemo(() => {
    if (!watchedItem?.claim_date) return null;
    const cycle = getClaimCyclePeriod(watchedItem.claim_date);
    return `Submit by ${cycle.end}`;
  }, [watchedItem?.claim_date]);

  const limitHint = useMemo(() => {
    if (!selectedType) return null;
    if (selectedType.limit_amount == null) return null;
    const period = selectedType.limit_period || 'period';
    return `Limit: RM${Number(selectedType.limit_amount).toFixed(2)}/${period}`;
  }, [selectedType]);

  const hasAmount = (Number(watchedItem?.amount) || 0) > 0;
  const hasErrors = !!form.formState.errors.items?.[index];

  // Summary line for collapsed state
  const summaryParts: string[] = [];
  if (selectedType) summaryParts.push(selectedType.name);
  if (watchedItem?.claim_date) summaryParts.push(watchedItem.claim_date);

  return (
    <Card
      className={`overflow-hidden transition-shadow ${hasErrors ? 'ring-1 ring-destructive/30' : ''} ${open ? 'shadow-sm' : ''}`}
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        {/* Collapsed header / summary strip */}
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
          >
            {/* Item number pill */}
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {index + 1}
            </span>

            {/* Summary text */}
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {summaryParts.length > 0 ? (
                <span className="truncate text-sm font-medium">
                  {summaryParts.join(' \u00B7 ')}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  New claim item
                </span>
              )}
              {hasErrors && !open && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  Incomplete
                </Badge>
              )}
            </div>

            {/* Amount */}
            {hasAmount && (
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                RM{Number(watchedItem!.amount).toFixed(2)}
              </span>
            )}

            {/* Attachments indicator */}
            {(watchedItem?.receipt_urls?.length ?? 0) > 0 && (
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}

            {/* Chevron */}
            {open ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-4 border-t px-4 pb-4 pt-4">
            {/* Row 1: Claim type (full width) */}
            <FormField
              control={form.control}
              name={`items.${index}.claim_type_id`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Claim Type *</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isSubmitting}
                    >
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
                  {limitHint && (
                    <p className="text-xs text-muted-foreground">{limitHint}</p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Row 2: Date + Amount side by side */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name={`items.${index}.claim_date`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Receipt Date *</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={field.value}
                        onChange={field.onChange}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    {cycleHint && (
                      <p className="text-xs text-muted-foreground">
                        {cycleHint}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`items.${index}.amount`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (RM) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 3: Purpose */}
            <FormField
              control={form.control}
              name={`items.${index}.purpose`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purpose</FormLabel>
                  <FormControl>
                    <Textarea
                      value={field.value || ''}
                      onChange={field.onChange}
                      placeholder="Optional description"
                      rows={2}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Row 4: Attachments */}
            {selectedType?.requires_attachment !== false && (
              <FormField
                control={form.control}
                name={`items.${index}.receipt_urls`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Receipts</FormLabel>
                    <FormControl>
                      <FileUpload
                        bucket="claim-attachments"
                        onUploadComplete={(urls) => field.onChange(urls)}
                        onRemove={(idx) => {
                          const cur = field.value || [];
                          field.onChange(cur.filter((_, i) => i !== idx));
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

            {/* Remove button */}
            {canRemove && (
              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                  onClick={onRemove}
                  disabled={isSubmitting}
                >
                  <X className="h-3.5 w-3.5" />
                  Remove item
                </Button>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
