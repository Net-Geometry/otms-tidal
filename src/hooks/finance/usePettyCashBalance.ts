import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

function toSignedAmount(txnType: string, amount: number) {
  if (txnType === 'top_up') return Number(amount || 0);
  return -Number(amount || 0);
}

export function usePettyCashBalance() {
  const db = supabase as any;

  return useQuery({
    queryKey: ['petty-cash-balance'],
    queryFn: async () => {
      const [{ data: txns, error: txnError }, { data: settings, error: settingsError }] = await Promise.all([
        db
          .from('petty_cash_transactions')
          .select('txn_type, amount')
          .eq('status', 'approved'),
        db
          .from('petty_cash_settings')
          .select('float_amount')
          .eq('id', 1)
          .single(),
      ]);

      if (txnError) throw txnError;
      if (settingsError) throw settingsError;

      const approved = txns || [];
      const totalTopUps = approved
        .filter((row: any) => row.txn_type === 'top_up')
        .reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);
      const totalExpenditures = approved
        .filter((row: any) => row.txn_type === 'expenditure')
        .reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);
      const balance = approved.reduce((sum: number, row: any) => sum + toSignedAmount(row.txn_type, row.amount), 0);

      const floatAmount = Number(settings?.float_amount || 0);
      const utilizationPct = floatAmount > 0 ? Math.min((totalExpenditures / floatAmount) * 100, 999) : 0;

      return {
        balance,
        totalTopUps,
        totalExpenditures,
        floatAmount,
        utilizationPct,
      };
    },
    staleTime: 20 * 1000,
  });
}
