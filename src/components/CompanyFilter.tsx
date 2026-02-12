import { Building2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Company } from '@/hooks/hr/useCompanies';

interface CompanyFilterProps {
  companies: Company[];
  selectedCompanyId: string;
  onCompanyChange: (id: string) => void;
  isLoading?: boolean;
}

export function CompanyFilter({
  companies,
  selectedCompanyId,
  onCompanyChange,
  isLoading = false,
}: CompanyFilterProps) {
  return (
    <Select value={selectedCompanyId} onValueChange={onCompanyChange} disabled={isLoading}>
      <SelectTrigger className="w-[240px] border-border focus:border-primary focus:ring-primary">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder="All Companies" />
        </div>
      </SelectTrigger>
      <SelectContent className="z-50">
        <SelectItem value="all">All Companies</SelectItem>
        {companies.map((company) => (
          <SelectItem key={company.id} value={company.id}>
            {company.name} ({company.code})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
