begin;

-- RLS chooses visible rows. Column grants limit what a directory reader sees.
revoke select on public.companies from public, anon, authenticated;
revoke select (cnpj, email, phone, address, cep, onboarding_done)
  on public.companies from public, anon, authenticated;
grant select (id, company_name, trade_name, city, state, segment, description,
  website, instagram, linkedin, logo_url, banner_url, role, verified, active,
  rating, review_count, created_at, updated_at)
  on public.companies to authenticated;

create or replace function public.get_my_company()
returns setof public.companies
language sql stable security definer
set search_path = ''
as $$
  select c.* from public.companies c where c.id = auth.uid();
$$;

create or replace function public.list_companies_for_admin()
returns setof public.companies
language sql stable security definer
set search_path = ''
as $$
  select c.*
    from public.companies c
   where exists (
     select 1 from public.companies viewer
      where viewer.id = auth.uid() and viewer.active and viewer.role = 'admin'
   )
   order by c.created_at desc;
$$;

revoke all on function public.get_my_company() from public, anon, authenticated;
revoke all on function public.list_companies_for_admin() from public, anon, authenticated;
grant execute on function public.get_my_company() to authenticated;
grant execute on function public.list_companies_for_admin() to authenticated;

-- Preserve the shared history. Participants use the existing cancellation transition.
drop policy if exists negotiations_delete_self on public.negotiations;
revoke delete on public.negotiations from public, anon, authenticated;

-- Activity records are written by server-side triggers.
drop policy if exists activity_logs_insert_self on public.activity_logs;
revoke insert on public.activity_logs from public, anon, authenticated;

drop policy if exists reports_insert_self on public.reports;
create policy reports_insert_self on public.reports for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and status = 'pending'
    and resolved_at is null
    and target_type in ('product', 'company', 'message')
  );

-- Privatize in place so existing files and object paths are preserved.
insert into storage.buckets (id, name, public)
values ('produtos', 'produtos', false)
on conflict (id) do update set public = false;

drop policy if exists produtos_storage_select_public on storage.objects;
drop policy if exists produtos_storage_select_authenticated on storage.objects;
drop policy if exists produtos_storage_require_visible on storage.objects;
drop policy if exists produtos_storage_require_auth on storage.objects;

create policy produtos_storage_require_auth
  on storage.objects as restrictive for select to anon using (bucket_id <> 'produtos');

create policy produtos_storage_select_authenticated
  on storage.objects for select to authenticated using (bucket_id = 'produtos');

-- Restrictive so another permissive storage policy cannot expose these files.
create policy produtos_storage_require_visible
  on storage.objects as restrictive for select to authenticated using (
    bucket_id <> 'produtos'
    or (
      (select auth.uid()) is not null
      and public.is_current_company_active()
      and (
        (storage.foldername(name))[1] = (select auth.uid())::text
        or exists (
          select 1 from public.companies c
           where c.id::text = (storage.foldername(storage.objects.name))[1]
             and (storage.foldername(storage.objects.name))[2] = 'company'
             and (
               storage.objects.name in (c.logo_url, c.banner_url)
               or pg_catalog.right(c.logo_url, length(storage.objects.name) + 1) = '/' || storage.objects.name
               or pg_catalog.right(c.banner_url, length(storage.objects.name) + 1) = '/' || storage.objects.name
             )
        )
        or exists (
          select 1 from public.produtos p
           where p.created_by::text = (storage.foldername(storage.objects.name))[1]
             and (
               storage.objects.name = p.main_image
               or storage.objects.name = any(p.images)
               or storage.objects.name = any(p.documents)
             )
        )
      )
    )
  );

commit;
