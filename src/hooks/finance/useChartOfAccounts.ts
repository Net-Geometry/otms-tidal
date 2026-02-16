import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { AccountType, ChartOfAccount } from '@/types/finance';

export interface ChartOfAccountsFilters {
  accountType?: AccountType | 'all';
  activity?: 'all' | 'active' | 'inactive';
  search?: string;
}

function buildTree(accounts: ChartOfAccount[]): ChartOfAccount[] {
  const map = new Map<string, ChartOfAccount>();
  for (const account of accounts) {
    map.set(account.id, { ...account, children: [] });
  }

  const roots: ChartOfAccount[] = [];
  for (const account of map.values()) {
    if (account.parent_id && map.has(account.parent_id)) {
      map.get(account.parent_id)?.children?.push(account);
    } else {
      roots.push(account);
    }
  }

  const sortNodes = (nodes: ChartOfAccount[]) => {
    nodes.sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return a.account_code.localeCompare(b.account_code);
    });
    for (const node of nodes) {
      if (node.children?.length) sortNodes(node.children);
    }
  };

  sortNodes(roots);
  return roots;
}

function filterTree(nodes: ChartOfAccount[], filters: ChartOfAccountsFilters): ChartOfAccount[] {
  const query = (filters.search || '').trim().toLowerCase();

  const isNodeMatch = (node: ChartOfAccount) => {
    const accountTypeMatch = !filters.accountType || filters.accountType === 'all' || node.account_type === filters.accountType;
    const activityMatch =
      !filters.activity ||
      filters.activity === 'all' ||
      (filters.activity === 'active' ? node.is_active : !node.is_active);
    const searchMatch =
      !query ||
      node.account_code.toLowerCase().includes(query) ||
      node.account_name.toLowerCase().includes(query) ||
      (node.description || '').toLowerCase().includes(query) ||
      (node.system_tag || '').toLowerCase().includes(query);

    return accountTypeMatch && activityMatch && searchMatch;
  };

  const walk = (node: ChartOfAccount): ChartOfAccount | null => {
    const filteredChildren = (node.children || [])
      .map(walk)
      .filter((child): child is ChartOfAccount => !!child);

    if (isNodeMatch(node) || filteredChildren.length > 0) {
      return {
        ...node,
        children: filteredChildren,
      };
    }

    return null;
  };

  return nodes.map(walk).filter((node): node is ChartOfAccount => !!node);
}

export function useChartOfAccounts(filters: ChartOfAccountsFilters = {}) {
  const db = supabase as any;

  const query = useQuery({
    queryKey: ['chart-of-accounts'],
    queryFn: async () => {
      const { data, error } = await db
        .from('chart_of_accounts')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('account_code', { ascending: true });

      if (error) throw error;
      return (data || []) as ChartOfAccount[];
    },
    staleTime: 60 * 1000,
  });

  const tree = useMemo(() => {
    const accounts = query.data || [];
    const built = buildTree(accounts);
    return filterTree(built, filters);
  }, [query.data, filters.accountType, filters.activity, filters.search]);

  return {
    ...query,
    accounts: query.data || [],
    tree,
  };
}

type UpsertAccountInput = Partial<ChartOfAccount> & {
  account_code: string;
  account_name: string;
  account_type: AccountType;
  level: 1 | 2 | 3;
};

export function useUpsertAccount() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: UpsertAccountInput) => {
      if (input.id) {
        const { error } = await db
          .from('chart_of_accounts')
          .update({
            parent_id: input.parent_id || null,
            account_code: input.account_code,
            account_name: input.account_name,
            account_type: input.account_type,
            level: input.level,
            is_postable: input.level === 3 ? !!input.is_postable : false,
            is_active: input.is_active ?? true,
            description: input.description || null,
            sort_order: input.sort_order ?? 0,
            system_tag: input.system_tag || null,
            currency_code: input.currency_code || null,
          })
          .eq('id', input.id);
        if (error) throw error;
        return;
      }

      const { error } = await db
        .from('chart_of_accounts')
        .insert({
          parent_id: input.parent_id || null,
          account_code: input.account_code,
          account_name: input.account_name,
          account_type: input.account_type,
          level: input.level,
          is_postable: input.level === 3 ? !!input.is_postable : false,
          is_active: input.is_active ?? true,
          description: input.description || null,
          sort_order: input.sort_order ?? 0,
          system_tag: input.system_tag || null,
          currency_code: input.currency_code || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
      toast({ title: 'Saved', description: 'Account saved successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    upsertAccount: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}

export function useDeleteAccount() {
  const db = supabase as any;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from('chart_of_accounts')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
      toast({ title: 'Updated', description: 'Account marked as inactive' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    deleteAccount: mutation.mutateAsync,
    isDeleting: mutation.isPending,
  };
}
