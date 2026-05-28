alter table public.companies
add column if not exists parent_company_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'companies_parent_company_id_fkey'
      and conrelid = 'public.companies'::regclass
  ) then
    alter table public.companies
      add constraint companies_parent_company_id_fkey
      foreign key (parent_company_id)
      references public.companies(id);
  end if;
end $$;

create index if not exists idx_companies_parent_company_id
  on public.companies(parent_company_id);
