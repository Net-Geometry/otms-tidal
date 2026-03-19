/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { BankAccount, GLReferenceType } from '@/types/finance';

function toNumber(value: unknown) {
  return Number(value || 0);
}

export interface CashBookFilters {
  companyId?: string;
  bankAccountId?: string;
  startDate?: string;
  endDate?: string;
}

export interface CashBookEntry {
  id: string;
  entry_date: string;
  entry_number: string;
  description: string;
  reference_type: GLReferenceType;
  reference_id: string | null;
  source_doc: string | null;
  debit_amount: number;
  credit_amount: number;
  running_balance: number;
}

export function useCashBook(filters: CashBookFilters = {}) {
  const db = supabase as any;
  const { profile } = useAuth();
  const companyId = filters.companyId || profile?.company_id;

  // Fetch bank accounts for the company (for the dropdown and to get gl_account_ids)
  const bankAccountsQuery = useQuery({
    queryKey: ['cash-book-bank-accounts', companyId || 'none'],
    queryFn: async () => {
      if (!companyId) return [] as BankAccount[];

      const { data, error } = await db
        .from('bank_accounts')
        .select(`
          *,
          companies:companies!bank_accounts_company_id_fkey(id, name, code),
          gl_account:chart_of_accounts!bank_accounts_gl_account_id_fkey(id, account_code, account_name)
        `)
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('account_code', { ascending: true });

      if (error) throw error;

      return ((data || []) as BankAccount[]).map((row) => ({
        ...row,
        current_balance: toNumber(row.current_balance),
      }));
    },
    enabled: !!companyId,
    staleTime: 30 * 1000,
  });

  const bankAccounts = bankAccountsQuery.data || [];

  // Determine which GL account IDs to query
  const glAccountIds = useMemo(() => {
    if (filters.bankAccountId) {
      const bank = bankAccounts.find((b) => b.id === filters.bankAccountId);
      return bank?.gl_account_id ? [bank.gl_account_id] : [];
    }
    return bankAccounts
      .map((b) => b.gl_account_id)
      .filter((id): id is string => !!id);
  }, [bankAccounts, filters.bankAccountId]);

  // Fetch journal entry lines for bank/cash GL accounts
  const entriesQuery = useQuery({
    queryKey: [
      'cash-book-entries',
      companyId || 'none',
      filters.bankAccountId || 'all',
      filters.startDate || '',
      filters.endDate || '',
      glAccountIds.join(','),
    ],
    queryFn: async () => {
      if (!companyId || glAccountIds.length === 0) {
        return [] as CashBookEntry[];
      }

      // Query journal_entry_lines filtered to bank GL accounts
      let q = db
        .from('journal_entry_lines')
        .select(`
          id,
          debit_amount,
          credit_amount,
          journal_entry:journal_entries!journal_entry_lines_journal_entry_id_fkey(
            id,
            entry_number,
            entry_date,
            description,
            reference_type,
            reference_id,
            company_id,
            is_reversed,
            created_at
          )
        `)
        .in('account_id', glAccountIds);

      const { data, error } = await q;
      if (error) throw error;

      // Filter by company_id and date range client-side (since we joined)
      const rows = ((data || []) as any[])
        .filter((row) => {
          const je = row.journal_entry;
          if (!je) return false;
          if (je.company_id !== companyId) return false;
          if (filters.startDate && je.entry_date < filters.startDate) return false;
          if (filters.endDate && je.entry_date > filters.endDate) return false;
          return true;
        })
        .sort((a, b) => {
          const dateA = a.journal_entry.entry_date;
          const dateB = b.journal_entry.entry_date;
          if (dateA !== dateB) return dateA.localeCompare(dateB);
          const createdA = a.journal_entry.created_at || '';
          const createdB = b.journal_entry.created_at || '';
          return createdA.localeCompare(createdB);
        });

      // Batch-fetch source document numbers for payment_voucher references
      const pvRefIds = [
        ...new Set(
          rows
            .filter((r) => r.journal_entry.reference_type === 'payment_voucher' && r.journal_entry.reference_id)
            .map((r) => r.journal_entry.reference_id as string)
        ),
      ];

      const pvNumberMap = new Map<string, string>();
      if (pvRefIds.length > 0) {
        const { data: pvRows } = await db
          .from('payment_vouchers')
          .select('id, pv_number')
          .in('id', pvRefIds);
        for (const pv of pvRows || []) {
          if (pv.pv_number) pvNumberMap.set(pv.id, pv.pv_number);
        }
      }

      // Compute running balance client-side
      let runningBalance = 0;
      const entries: CashBookEntry[] = rows.map((row) => {
        const debit = toNumber(row.debit_amount);
        const credit = toNumber(row.credit_amount);
        runningBalance += debit - credit;

        const refId = row.journal_entry.reference_id || null;
        const refType = row.journal_entry.reference_type as GLReferenceType;

        let sourceDoc: string | null = null;
        if (refType === 'payment_voucher' && refId) {
          sourceDoc = pvNumberMap.get(refId) || null;
        }

        return {
          id: row.id,
          entry_date: row.journal_entry.entry_date,
          entry_number: row.journal_entry.entry_number,
          description: row.journal_entry.description || '',
          reference_type: refType,
          reference_id: refId,
          source_doc: sourceDoc,
          debit_amount: debit,
          credit_amount: credit,
          running_balance: runningBalance,
        };
      });

      return entries;
    },
    enabled: !!companyId && glAccountIds.length > 0,
    staleTime: 20 * 1000,
  });

  const entries = entriesQuery.data || [];

  // Compute totals
  const totals = useMemo(() => {
    return entries.reduce(
      (acc, entry) => {
        acc.totalDebit += entry.debit_amount;
        acc.totalCredit += entry.credit_amount;
        return acc;
      },
      { totalDebit: 0, totalCredit: 0 },
    );
  }, [entries]);

  const closingBalance = entries.length > 0 ? entries[entries.length - 1].running_balance : 0;

  return {
    entries,
    isLoading: bankAccountsQuery.isLoading || entriesQuery.isLoading,
    bankAccounts,
    totalDebit: totals.totalDebit,
    totalCredit: totals.totalCredit,
    closingBalance,
  };
}
