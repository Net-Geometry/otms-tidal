import type { Company } from '@/hooks/hr/useCompanies';

export function getSelectedCompanyName(companyId: string, companies: Company[]): string {
  if (companyId === 'all') {
    return 'All Companies';
  }

  const selectedCompany = companies.find((company) => company.id === companyId);
  return selectedCompany?.name ?? 'All Companies';
}
