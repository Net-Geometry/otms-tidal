import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Company {
  id: string;
  name: string;
  code: string;
  parent_company_id: string | null;
  registration_no: string | null;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompaniesGrouped {
  all: Company[];
  parent: Company | null;
  subsidiaries: Company[];
}

const COMPANIES_QUERY_KEY = ['companies'];

async function fetchCompanies(): Promise<Company[]> {
  const db = supabase as any;
  const { data, error } = await db
    .from('companies')
    .select('id, name, code, parent_company_id, registration_no, address, phone, is_active, created_at, updated_at')
    .eq('is_active', true)
    .order('name');

  if (error) throw error;
  return data as Company[];
}

function groupCompanies(companies: Company[]): CompaniesGrouped {
  const subsidiaries = companies.filter((c) => c.parent_company_id !== null);
  const parentIds = new Set(subsidiaries.map((c) => c.parent_company_id));

  // Parent = a company with no parent_company_id whose id is referenced
  // by at least one other company as parent_company_id
  const parent =
    companies.find(
      (c) => c.parent_company_id === null && parentIds.has(c.id)
    ) ?? null;

  return { all: companies, parent, subsidiaries };
}

/** Returns flat list of active companies (backward-compatible). */
export function useCompanies() {
  return useQuery({
    queryKey: COMPANIES_QUERY_KEY,
    queryFn: fetchCompanies,
  });
}

/** Returns active companies grouped into parent + subsidiaries. */
export function useCompaniesGrouped() {
  return useQuery({
    queryKey: COMPANIES_QUERY_KEY,
    queryFn: fetchCompanies,
    select: groupCompanies,
  });
}
