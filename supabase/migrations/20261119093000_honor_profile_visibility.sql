-- Apply the user's profile visibility setting to company and listing reads.
create or replace function public.can_view_company_profile(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_company_id is not null
    and (
      p_company_id = auth.uid()
      or exists (
        select 1
          from public.companies viewer
         where viewer.id = auth.uid()
           and viewer.role = 'admin'
           and viewer.active = true
      )
      or coalesce(
        (select settings.privacy_profile
           from public.user_settings settings
          where settings.user_id = p_company_id),
        true
      )
    );
$$;

revoke all on function public.can_view_company_profile(uuid) from public, anon;
grant execute on function public.can_view_company_profile(uuid) to authenticated;

drop policy if exists companies_select_auth on public.companies;
create policy companies_select_auth on public.companies
  for select using (
    auth.role() = 'authenticated'
    and public.can_view_company_profile(id)
  );

drop policy if exists produtos_select_auth on public.produtos;
create policy produtos_select_auth on public.produtos
  for select using (
    auth.role() = 'authenticated'
    and public.can_view_company_profile(created_by)
  );
