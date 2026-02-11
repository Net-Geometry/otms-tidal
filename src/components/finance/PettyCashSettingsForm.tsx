import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import type { PettyCashSettings } from '@/types/finance';

const schema = z.object({
  float_amount: z.coerce.number().min(0, 'Float amount must be 0 or greater'),
  approval_threshold: z.coerce.number().min(0, 'Threshold must be 0 or greater'),
});

type Values = z.infer<typeof schema>;

interface PettyCashSettingsFormProps {
  settings?: PettyCashSettings;
  onSave: (values: Values) => Promise<void>;
  isSaving?: boolean;
}

export function PettyCashSettingsForm({ settings, onSave, isSaving }: PettyCashSettingsFormProps) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: {
      float_amount: Number(settings?.float_amount || 500),
      approval_threshold: Number(settings?.approval_threshold || 100),
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Petty Cash Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="float_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Float Amount (RM)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="approval_threshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Approval Threshold (RM)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={!!isSaving}>
                {isSaving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
