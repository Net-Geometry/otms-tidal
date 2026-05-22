import { useMemo, useState } from 'react';
import { Building2, ImageIcon, RotateCcw, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CompanyLogoUpload } from './CompanyLogoUpload';
import { useCompanies } from '@/hooks/hr/useCompanies';
import { deleteCompanyLogo, uploadCompanyLogoForCompany, useUpdateCompany } from '@/hooks/hr/useUpdateCompanyProfile';
import { toast } from 'sonner';

export function CompanyLogosTab() {
  const { data: companies = [], isLoading } = useCompanies();
  const updateCompany = useUpdateCompany();
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadingCompanyId, setUploadingCompanyId] = useState<string | null>(null);

  const filteredCompanies = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return companies;

    return companies.filter((company) => (
      company.name.toLowerCase().includes(query) ||
      company.code.toLowerCase().includes(query)
    ));
  }, [companies, searchQuery]);

  const handleLogoUpload = async (companyId: string, currentLogoUrl: string | null, file: File) => {
    setUploadingCompanyId(companyId);
    try {
      const logoUrl = await uploadCompanyLogoForCompany(companyId, file);

      if (currentLogoUrl) {
        await deleteCompanyLogo(currentLogoUrl);
      }

      await updateCompany.mutateAsync({
        companyId,
        data: { logo_url: logoUrl },
      });

      toast.success('Company logo uploaded');
    } catch (error) {
      console.error('Company logo upload failed:', error);
      toast.error('Failed to upload company logo');
    } finally {
      setUploadingCompanyId(null);
    }
  };

  const handleLogoReset = async (companyId: string, currentLogoUrl: string | null) => {
    if (!currentLogoUrl) return;

    setUploadingCompanyId(companyId);
    try {
      await deleteCompanyLogo(currentLogoUrl);
      await updateCompany.mutateAsync({
        companyId,
        data: { logo_url: null },
      });

      toast.success('Company logo removed');
    } catch (error) {
      console.error('Company logo reset failed:', error);
      toast.error('Failed to remove company logo');
    } finally {
      setUploadingCompanyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card/60 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ImageIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Company Logos</h3>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Manage logos for individual companies. By-company OT reports use the matching company logo automatically.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-background/70 p-3 text-sm sm:min-w-[260px]">
            <div>
              <div className="text-muted-foreground">Companies</div>
              <div className="text-xl font-semibold">{companies.length}</div>
            </div>
            <div>
              <div className="text-muted-foreground">With Logos</div>
              <div className="text-xl font-semibold">{companies.filter((company) => company.logo_url).length}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search company name or code..."
          className="pl-10"
          aria-label="Search companies"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading companies...</div>
      ) : filteredCompanies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
          No companies found.
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredCompanies.map((company) => (
            <Card key={company.id} className="overflow-hidden border-border bg-card/70 shadow-sm">
              <div className="grid gap-0 md:grid-cols-[180px_1fr]">
                <div className="flex flex-col items-center justify-center gap-3 border-b border-border bg-muted/25 p-5 md:border-b-0 md:border-r">
                  <LogoPreview name={company.name} logoUrl={company.logo_url} />
                  <div className="text-center">
                    <div className="font-semibold leading-tight">{company.code}</div>
                    <div className="text-xs text-muted-foreground">
                      {company.logo_url ? 'Logo active' : 'Default initials'}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <div className="space-y-1">
                    <div className="flex items-start gap-2">
                      <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <div>
                        <h4 className="font-semibold leading-tight">{company.name}</h4>
                        <p className="text-xs text-muted-foreground">
                          Report header logo for {company.code}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Upload logo</Label>
                    <CompanyLogoUpload
                      onFileSelect={(file) => handleLogoUpload(company.id, company.logo_url, file)}
                      isUploading={uploadingCompanyId === company.id}
                      compact
                    />
                  </div>

                  {company.logo_url && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleLogoReset(company.id, company.logo_url)}
                      disabled={uploadingCompanyId === company.id || updateCompany.isPending}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                      Reset Logo
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function LogoPreview({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`${name} logo`}
        className="h-24 w-24 rounded-2xl border border-border bg-background object-contain p-2 shadow-sm"
      />
    );
  }

  return (
    <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-border bg-background shadow-sm">
      <span className="text-2xl font-bold text-primary">{getInitials(name)}</span>
    </div>
  );
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter((word) => word.length > 0 && word !== '&')
    .slice(0, 3)
    .map((word) => word[0].toUpperCase())
    .join('');
}
