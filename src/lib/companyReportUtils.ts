export interface CompanyGroup {
  companyId: string;
  companyName: string;
  companyCode: string;
  employees: any[];
  stats: {
    totalEmployees: number;
    totalHours: number;
    totalCost: number;
  };
}

export function groupByCompany<T extends {
  company_id: string;
  company_name: string;
  company_code: string;
  total_ot_hours: number;
  amount: number;
}>(employees: T[]): CompanyGroup[] {
  const companyMap = new Map<string, CompanyGroup>();

  employees.forEach(employee => {
    const companyId = employee.company_id || 'unknown';
    
    if (!companyMap.has(companyId)) {
      companyMap.set(companyId, {
        companyId,
        companyName: employee.company_name || 'Unknown Company',
        companyCode: employee.company_code || 'N/A',
        employees: [],
        stats: {
          totalEmployees: 0,
          totalHours: 0,
          totalCost: 0,
        },
      });
    }

    const group = companyMap.get(companyId)!;
    group.employees.push(employee);
    group.stats.totalEmployees++;
    group.stats.totalHours += employee.total_ot_hours || 0;
    group.stats.totalCost += employee.amount || 0;
  });

  return Array.from(companyMap.values()).sort((a, b) => 
    a.companyName.localeCompare(b.companyName)
  );
}

export function calculateOverallStats(companyGroups: CompanyGroup[]) {
  return {
    totalCompanies: companyGroups.length,
    totalEmployees: companyGroups.reduce((sum, g) => sum + g.stats.totalEmployees, 0),
    totalHours: companyGroups.reduce((sum, g) => sum + g.stats.totalHours, 0),
    totalCost: companyGroups.reduce((sum, g) => sum + g.stats.totalCost, 0),
  };
}
