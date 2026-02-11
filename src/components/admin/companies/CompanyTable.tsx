import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ResponsiveTable } from '@/components/ui/responsive-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Pencil, Power } from 'lucide-react';
import { Company } from '@/hooks/hr/useCompanies';
import { useToggleCompanyStatus } from '@/hooks/admin/useToggleCompanyStatus';

interface CompanyTableProps {
  companies: Company[];
  onEdit: (company: Company) => void;
}

export function CompanyTable({ companies, onEdit }: CompanyTableProps) {
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const toggleCompanyStatus = useToggleCompanyStatus();

  const handleToggleStatus = () => {
    if (!selectedCompany) return;

    toggleCompanyStatus.mutate({
      id: selectedCompany.id,
      is_active: !!selectedCompany.is_active,
    });
    setSelectedCompany(null);
  };

  return (
    <>
      <ResponsiveTable
        cardConfig={{
          data: companies,
          emptyMessage: 'No companies found',
          render: (company) => {
            const isActive = !!company.is_active;

            return {
              title: company.name,
              subtitle: company.code,
              fields: [
                {
                  label: 'Registration No',
                  value: company.registration_no || '-',
                },
                {
                  label: 'Phone',
                  value: company.phone || '-',
                },
                {
                  label: 'Status',
                  value: (
                    <Badge variant={isActive ? 'default' : 'secondary'}>
                      {isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  ),
                },
              ],
              actions: (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(company);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCompany(company);
                    }}
                    disabled={toggleCompanyStatus.isPending}
                  >
                    <Power className="h-4 w-4" />
                  </Button>
                </div>
              ),
              className: !isActive ? 'opacity-60' : undefined,
            };
          },
        }}
      >
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Registration No</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No companies found
                  </TableCell>
                </TableRow>
              ) : (
                companies.map((company) => {
                  const isActive = !!company.is_active;

                  return (
                    <TableRow key={company.id} className={!isActive ? 'opacity-60' : undefined}>
                      <TableCell>
                        <Badge variant="secondary" className="font-mono">
                          {company.code}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{company.name}</TableCell>
                      <TableCell>{company.registration_no || '-'}</TableCell>
                      <TableCell>{company.phone || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={isActive ? 'default' : 'secondary'}>
                          {isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => onEdit(company)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedCompany(company)}
                            disabled={toggleCompanyStatus.isPending}
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </ResponsiveTable>

      <AlertDialog
        open={!!selectedCompany}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedCompany(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedCompany?.is_active ? 'Deactivate Company' : 'Reactivate Company'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedCompany?.is_active
                ? 'This company will no longer appear in active company selections.'
                : 'This company will appear again in active company selections.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleStatus}>
              {selectedCompany?.is_active ? 'Deactivate' : 'Reactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
