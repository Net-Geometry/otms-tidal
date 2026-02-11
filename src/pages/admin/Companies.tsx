import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { PageLayout } from '@/components/ui/page-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Company } from '@/hooks/hr/useCompanies';
import { useAllCompanies } from '@/hooks/admin/useAllCompanies';
import { CompanyTable } from '@/components/admin/companies/CompanyTable';
import { CompanyDialog } from '@/components/admin/companies/CompanyDialog';

export default function Companies() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  const { data: companies = [], isLoading } = useAllCompanies();

  const filteredCompanies = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return companies;
    }

    return companies.filter((company) =>
      company.name.toLowerCase().includes(query) ||
      company.code.toLowerCase().includes(query)
    );
  }, [companies, searchQuery]);

  const handleCreate = () => {
    setSelectedCompany(null);
    setShowDialog(true);
  };

  const handleEdit = (company: Company) => {
    setSelectedCompany(company);
    setShowDialog(true);
  };

  return (
    <AppLayout>
      <PageLayout
        title="Companies"
        description="Manage company records, activation status, and company details"
        actions={
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Company
          </Button>
        }
      >
        <Card className="p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search companies by name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </Card>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <CompanyTable companies={filteredCompanies} onEdit={handleEdit} />
        )}
      </PageLayout>

      <CompanyDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        company={selectedCompany}
      />
    </AppLayout>
  );
}
