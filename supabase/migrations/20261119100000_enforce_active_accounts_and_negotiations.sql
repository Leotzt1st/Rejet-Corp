-- Recheck account state in PostgreSQL for every authenticated API request.
-- Keep the helper limited to the caller's own company to avoid status oracles.
create or replace function public.is_current_company_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.companies c
     where c.id = auth.uid()
       and c.active = true
  );
$$;

revoke all on function public.is_current_company_active() from public, anon;
grant execute on function public.is_current_company_active() to authenticated;

-- A suspended owner can still load their own row to see the suspension notice.
-- Other users see only active profiles, with the existing privacy preference.
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
      or (
        exists (
          select 1
            from public.companies viewer
           where viewer.id = auth.uid()
             and viewer.active = true
        )
        and (
          exists (
            select 1
              from public.companies viewer
             where viewer.id = auth.uid()
               and viewer.role = 'admin'
               and viewer.active = true
          )
          or exists (
            select 1
              from public.companies owner
             where owner.id = p_company_id
               and owner.active = true
               and coalesce(
                 (select settings.privacy_profile
                    from public.user_settings settings
                   where settings.user_id = p_company_id),
                 true
               )
          )
        )
      )
    );
$$;

revoke all on function public.can_view_company_profile(uuid) from public, anon;
grant execute on function public.can_view_company_profile(uuid) to authenticated;

drop policy if exists companies_select_auth on public.companies;
create policy companies_select_auth on public.companies
  for select to authenticated
  using (public.can_view_company_profile(id));

drop policy if exists produtos_select_auth on public.produtos;
create policy produtos_select_auth on public.produtos
  for select to authenticated
  using (
    public.is_current_company_active()
    and public.can_view_company_profile(created_by)
  );

-- Restrictive policies add the suspension rule without weakening owner/admin
-- policies already defined on each table.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'categories', 'subcategories', 'produtos', 'favorites', 'conversations',
    'messages', 'negotiations', 'negotiation_history', 'notifications',
    'reviews', 'reports', 'activity_logs', 'user_settings'
  ] loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('drop policy if exists require_active_company_select on public.%I', v_table);
    execute format(
      'create policy require_active_company_select on public.%I as restrictive for select to authenticated using (public.is_current_company_active())',
      v_table
    );
  end loop;

  foreach v_table in array array[
    'categories', 'subcategories', 'produtos', 'favorites', 'conversations',
    'messages', 'negotiations', 'negotiation_history', 'notifications',
    'reviews', 'reports', 'activity_logs', 'user_settings'
  ] loop
    execute format('drop policy if exists require_active_company_insert on public.%I', v_table);
    execute format(
      'create policy require_active_company_insert on public.%I as restrictive for insert to authenticated with check (public.is_current_company_active())',
      v_table
    );
    execute format('drop policy if exists require_active_company_update on public.%I', v_table);
    execute format(
      'create policy require_active_company_update on public.%I as restrictive for update to authenticated using (public.is_current_company_active()) with check (public.is_current_company_active())',
      v_table
    );
    execute format('drop policy if exists require_active_company_delete on public.%I', v_table);
    execute format(
      'create policy require_active_company_delete on public.%I as restrictive for delete to authenticated using (public.is_current_company_active())',
      v_table
    );
  end loop;

  -- Do not guard company INSERT: first-time signup has no companies row yet.
  execute 'alter table public.companies enable row level security';
  execute 'drop policy if exists require_active_company_update on public.companies';
  execute 'create policy require_active_company_update on public.companies as restrictive for update to authenticated using (public.is_current_company_active()) with check (public.is_current_company_active())';
  execute 'drop policy if exists require_active_company_delete on public.companies';
  execute 'create policy require_active_company_delete on public.companies as restrictive for delete to authenticated using (public.is_current_company_active())';
end;
$$;

-- Keep the public marketplace bucket readable; only active accounts can mutate it.
drop policy if exists require_active_company_produtos_storage_insert on storage.objects;
create policy require_active_company_produtos_storage_insert
  on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'produtos' or public.is_current_company_active());

drop policy if exists require_active_company_produtos_storage_update on storage.objects;
create policy require_active_company_produtos_storage_update
  on storage.objects as restrictive for update to authenticated
  using (bucket_id <> 'produtos' or public.is_current_company_active())
  with check (bucket_id <> 'produtos' or public.is_current_company_active());

drop policy if exists require_active_company_produtos_storage_delete on storage.objects;
create policy require_active_company_produtos_storage_delete
  on storage.objects as restrictive for delete to authenticated
  using (bucket_id <> 'produtos' or public.is_current_company_active());

-- Bind new negotiations to the real owner of an active product.
drop policy if exists negotiations_insert_self on public.negotiations;
create policy negotiations_insert_self on public.negotiations
  for insert to authenticated
  with check (
    buyer_id = auth.uid()
    and seller_id <> auth.uid()
    and status = 'interesse'
    and exists (
      select 1
        from public.produtos p
       where p.id = negotiations.product_id
         and p.created_by = negotiations.seller_id
         and p.status = 'active'
    )
  );

drop policy if exists negotiations_update_self on public.negotiations;
create policy negotiations_update_self on public.negotiations
  for update to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid())
  with check (buyer_id = auth.uid() or seller_id = auth.uid());

-- Make identity and offer fields immutable; enforce the same transitions as the UI.
create or replace function public.guard_negotiation_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.buyer_id is distinct from auth.uid()
      or new.seller_id is null
      or new.seller_id = auth.uid()
      or new.status <> 'interesse'
      or not exists (
        select 1
          from public.produtos p
         where p.id = new.product_id
           and p.created_by = new.seller_id
           and p.status = 'active'
      ) then
      raise exception 'Negociação inválida ou produto indisponível.'
        using errcode = '42501';
    end if;

    new.id := pg_catalog.gen_random_uuid();
    new.created_at := pg_catalog.now();
    new.updated_at := new.created_at;
    return new;
  end if;

  if new.id is distinct from old.id
    or new.product_id is distinct from old.product_id
    or new.buyer_id is distinct from old.buyer_id
    or new.seller_id is distinct from old.seller_id
    or new.quantity is distinct from old.quantity
    or new.offered_price is distinct from old.offered_price
    or new.message is distinct from old.message
    or new.created_at is distinct from old.created_at then
    raise exception 'Os participantes e dados da proposta não podem ser alterados.'
      using errcode = '42501';
  end if;

  new.updated_at := pg_catalog.now();
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'cancelado'
    and old.status in ('interesse', 'em_negociacao')
    and auth.uid() in (old.buyer_id, old.seller_id) then
    return new;
  end if;

  if auth.uid() = old.seller_id
    and old.status in ('interesse', 'em_negociacao')
    and new.status in ('em_negociacao', 'aceito', 'recusado') then
    return new;
  end if;

  if new.status = 'finalizado'
    and old.status = 'aceito'
    and auth.uid() in (old.buyer_id, old.seller_id) then
    return new;
  end if;

  raise exception 'Transição de negociação não permitida.'
    using errcode = '42501';
end;
$$;

drop trigger if exists guard_negotiation_write on public.negotiations;
create trigger guard_negotiation_write
before insert or update on public.negotiations
for each row execute function public.guard_negotiation_write();

