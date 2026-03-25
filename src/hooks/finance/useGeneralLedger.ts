/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

import type { GLReferenceType, JournalEntry, JournalEntryLine } from '@/types/finance';

function toNumber(value: unknown) {
  return Number(value || 0);
}

function normalizeLine(line: any): JournalEntryLine {
  return {
    ...line,
    debit_amount: toNumber(line.debit_amount),
    credit_amount: toNumber(line.credit_amount),
  };
}

function normalizeEntry(entry: any): JournalEntry {
  return {
    ...entry,
    total_debit: toNumber(entry.total_debit),
    total_credit: toNumber(entry.total_credit),
  };
}

async function resolveCompanyId(db: any, fallbackCompanyId?: string | null) {
  if (fallbackCompanyId) return fallbackCompanyId;

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData?.user) throw new Error('Not authenticated');

  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('company_id')
    .eq('id', authData.user.id)
    .single();

  if (profileError) throw profileError;
  if (!profile?.company_id) throw new Error('No company is assigned to your profile');

  return profile.company_id as string;
}

export interface GLPostingLineInput {
  account_id: string;
  description?: string | null;
  debit_amount?: number;
  credit_amount?: number;
  cost_center?: string | null;
  project_id?: string | null;
}

export interface GLPostingInput {
  company_id?: string | null;
  entry_date?: string;
  description?: string | null;
  reference_type: GLReferenceType;
  reference_id?: string | null;
  prefix?: string;
  lines: GLPostingLineInput[];
}

export interface GLPostingResult {
  journal_entry_id: string;
  entry_number: string;
}

export async function createGLPosting(input: GLPostingInput): Promise<GLPostingResult> {
  const db = supabase as any;

  if (!input.lines || input.lines.length < 2) {
    throw new Error('At least two journal lines are required');
  }

  const totalDebit = input.lines.reduce((sum, line) => sum + toNumber(line.debit_amount), 0);
  const totalCredit = input.lines.reduce((sum, line) => sum + toNumber(line.credit_amount), 0);

  if (totalDebit <= 0 || totalCredit <= 0) {
    throw new Error('Both debit and credit totals must be greater than zero');
  }

  if (Math.abs(totalDebit - totalCredit) > 0.0001) {
    throw new Error('Journal entry is not balanced');
  }

  const companyId = await resolveCompanyId(db, input.company_id);

  const { data, error } = await db.rpc('finance_create_journal_entry', {
    p_company_id: companyId,
    p_entry_date: input.entry_date || new Date().toISOString().slice(0, 10),
    p_description: input.description || null,
    p_reference_type: input.reference_type,
    p_reference_id: input.reference_id || null,
    p_lines: input.lines,
    p_prefix: input.prefix || null,
  });

  if (error) throw error;

  const row = (data || [])[0];
  if (!row?.journal_entry_id || !row?.entry_number) {
    throw new Error('Failed to create journal entry');
  }

  return {
    journal_entry_id: row.journal_entry_id,
    entry_number: row.entry_number,
  };
}

export interface JournalEntryFilters {
  companyId?: string;
  page?: number;
  pageSize?: number;
  startDate?: string;
  endDate?: string;
  accountId?: string;
  referenceType?: GLReferenceType | 'all';
  search?: string;
}

export function useJournalEntries(filters: JournalEntryFilters = {}) {
  const db = supabase as any;
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 20;

  return useQuery({
    queryKey: [
      'journal-entries',
      filters.companyId || 'all',
      page,
      pageSize,
      filters.startDate || '',
      filters.endDate || '',
      filters.accountId || '',
      filters.referenceType || 'all',
      filters.search || '',
    ],
    queryFn: async () => {
      const companyId = filters.companyId;

      let filteredEntryIds: string[] | null = null;
      if (filters.accountId) {
        const { data: lineRows, error: lineErr } = await db
          .from('journal_entry_lines')
          .select('journal_entry_id')
          .eq('account_id', filters.accountId);
        if (lineErr) throw lineErr;
        filteredEntryIds = [
          ...new Set<string>(
            (lineRows || [])
              .map((row: any) => row.journal_entry_id)
              .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0),
          ),
        ];
        if (filteredEntryIds.length === 0) {
          return {
            entries: [] as JournalEntry[],
            total: 0,
            page,
            pageSize,
            totalPages: 0,
          };
        }
      }

      let q = db
        .from('journal_entries')
        .select(
          `
            *,
            posted_by_profile:profiles!journal_entries_posted_by_fkey(id, employee_id, full_name),
            reversed_by_profile:profiles!journal_entries_reversed_by_fkey(id, employee_id, full_name)
          `,
          { count: 'exact' },
        )
        .order('entry_date', { ascending: false })
        .order('entry_number', { ascending: false });

      if (companyId) q = q.eq('company_id', companyId);
      if (filters.startDate) q = q.gte('entry_date', filters.startDate);
      if (filters.endDate) q = q.lte('entry_date', filters.endDate);
      if (filters.referenceType && filters.referenceType !== 'all') q = q.eq('reference_type', filters.referenceType);
      if (filteredEntryIds) q = q.in('id', filteredEntryIds);

      const search = (filters.search || '').trim();
      if (search) {
        q = q.or(`entry_number.ilike.%${search}%,description.ilike.%${search}%`);
      }

      q = q.range((page - 1) * pageSize, page * pageSize - 1);

      const { data, error, count } = await q;
      if (error) throw error;

      const rows = (data || []) as JournalEntry[];
      const entryIds = rows.map((entry) => entry.id);

      const totalsByEntry = new Map<string, { debit: number; credit: number }>();
      if (entryIds.length) {
        const { data: lineTotals, error: lineTotalsError } = await db
          .from('journal_entry_lines')
          .select('journal_entry_id, debit_amount, credit_amount')
          .in('journal_entry_id', entryIds);
        if (lineTotalsError) throw lineTotalsError;

        for (const line of lineTotals || []) {
          const current = totalsByEntry.get(line.journal_entry_id) || { debit: 0, credit: 0 };
          current.debit += toNumber(line.debit_amount);
          current.credit += toNumber(line.credit_amount);
          totalsByEntry.set(line.journal_entry_id, current);
        }
      }

      const entries = rows.map((entry) => {
        const totals = totalsByEntry.get(entry.id) || { debit: 0, credit: 0 };
        return normalizeEntry({
          ...entry,
          total_debit: totals.debit,
          total_credit: totals.credit,
        });
      });

      const total = count || 0;
      return {
        entries,
        total,
        page,
        pageSize,
        totalPages: total > 0 ? Math.ceil(total / pageSize) : 0,
      };
    },
    enabled: true,
    staleTime: 20 * 1000,
  });
}

export function useJournalEntryDetail(id?: string | null) {
  const db = supabase as any;

  return useQuery({
    queryKey: ['journal-entry-detail', id || 'none'],
    queryFn: async () => {
      const { data, error } = await db
        .from('journal_entries')
        .select(
          `
            *,
            posted_by_profile:profiles!journal_entries_posted_by_fkey(id, employee_id, full_name),
            reversed_by_profile:profiles!journal_entries_reversed_by_fkey(id, employee_id, full_name),
            lines:journal_entry_lines(
              *,
              account:chart_of_accounts(id, account_code, account_name),
              project:projects(id, project_code, project_name)
            )
          `,
        )
        .eq('id', id)
        .single();

      if (error) throw error;

      const lines = ((data?.lines || []) as JournalEntryLine[]).map(normalizeLine);
      const totals = lines.reduce(
        (acc, line) => {
          acc.debit += toNumber(line.debit_amount);
          acc.credit += toNumber(line.credit_amount);
          return acc;
        },
        { debit: 0, credit: 0 },
      );

      return normalizeEntry({
        ...(data as JournalEntry),
        lines,
        total_debit: totals.debit,
        total_credit: totals.credit,
      });
    },
    enabled: !!id,
    staleTime: 20 * 1000,
  });
}

interface CreateManualJournalInput {
  company_id?: string | null;
  entry_date: string;
  description?: string | null;
  lines: GLPostingLineInput[];
}

export function useCreateJournalEntry() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: CreateManualJournalInput) => {
      return createGLPosting({
        company_id: input.company_id,
        entry_date: input.entry_date,
        description: input.description || null,
        reference_type: 'manual',
        reference_id: null,
        prefix: 'JV',
        lines: input.lines,
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entry-detail'] });
      toast({ title: 'Posted', description: `Journal entry ${result.entry_number} has been created` });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    createJournalEntry: mutation.mutateAsync,
    isCreating: mutation.isPending,
  };
}

export function useReverseJournalEntry() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: { journalEntryId: string; reason?: string }) => {
      const { data, error } = await db.rpc('finance_reverse_journal_entry', {
        p_journal_entry_id: input.journalEntryId,
        p_reason: input.reason || null,
      });
      if (error) throw error;

      const row = (data || [])[0];
      if (!row?.journal_entry_id || !row?.entry_number) {
        throw new Error('Failed to reverse journal entry');
      }

      return {
        journal_entry_id: row.journal_entry_id as string,
        entry_number: row.entry_number as string,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entry-detail'] });
      toast({ title: 'Reversed', description: `Reversal posted as ${result.entry_number}` });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    reverseJournalEntry: mutation.mutateAsync,
    isReversing: mutation.isPending,
  };
}

interface UseDocumentSequenceInput {
  prefix: string;
  company_id?: string | null;
  doc_date?: string;
}

export function useDocumentSequence() {
  const db = supabase as any;
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: UseDocumentSequenceInput) => {
      const companyId = await resolveCompanyId(db, input.company_id);
      const { data, error } = await db.rpc('finance_next_document_number', {
        p_company_id: companyId,
        p_prefix: input.prefix,
        p_doc_date: input.doc_date || new Date().toISOString().slice(0, 10),
      });
      if (error) throw error;
      if (!data) throw new Error('Failed to fetch next document number');
      return data as string;
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    getNextNumber: mutation.mutateAsync,
    isLoading: mutation.isPending,
  };
}

export function useGLPosting() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: GLPostingInput) => createGLPosting(input),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entry-detail'] });
      toast({ title: 'Posted', description: `GL posting completed (${result.entry_number})` });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    postToGL: mutation.mutateAsync,
    isPosting: mutation.isPending,
  };
}
