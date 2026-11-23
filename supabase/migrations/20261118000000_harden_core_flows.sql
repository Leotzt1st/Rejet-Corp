-- Corrige permissões e fluxos de conta, mensagens, avaliações e notificações.
-- Não remove dados existentes. Reaplicar é seguro; rollback deve manter as guardas de segurança.

create or replace function public.protect_company_admin_fields()
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
    new.role := 'company';
    new.verified := false;
    new.active := true;
    new.rating := 0;
    new.review_count := 0;
    return new;
  end if;

  if exists (
    select 1
      from public.companies
     where id = auth.uid()
       and role = 'admin'
       and active = true
  ) then
    return new;
  end if;

  new.role := old.role;
  new.verified := old.verified;
  new.active := old.active;
  new.rating := old.rating;
  new.review_count := old.review_count;
  return new;
end;
$$;

drop trigger if exists protect_company_admin_fields on public.companies;
create trigger protect_company_admin_fields
before insert or update on public.companies
for each row execute function public.protect_company_admin_fields();

drop policy if exists companies_update_admin on public.companies;
create policy companies_update_admin on public.companies
  for update using (
    exists (
      select 1 from public.companies c
       where c.id = auth.uid() and c.role = 'admin' and c.active = true
    )
  );

drop policy if exists categories_insert_admin on public.categories;
create policy categories_insert_admin on public.categories
  for insert with check (
    exists (
      select 1 from public.companies c
       where c.id = auth.uid() and c.role = 'admin' and c.active = true
    )
  );
drop policy if exists categories_update_admin on public.categories;
create policy categories_update_admin on public.categories
  for update using (
    exists (
      select 1 from public.companies c
       where c.id = auth.uid() and c.role = 'admin' and c.active = true
    )
  );
drop policy if exists categories_delete_admin on public.categories;
create policy categories_delete_admin on public.categories
  for delete using (
    exists (
      select 1 from public.companies c
       where c.id = auth.uid() and c.role = 'admin' and c.active = true
    )
  );

drop policy if exists subcategories_insert_admin on public.subcategories;
create policy subcategories_insert_admin on public.subcategories
  for insert with check (
    exists (
      select 1 from public.companies c
       where c.id = auth.uid() and c.role = 'admin' and c.active = true
    )
  );
drop policy if exists subcategories_delete_admin on public.subcategories;
create policy subcategories_delete_admin on public.subcategories
  for delete using (
    exists (
      select 1 from public.companies c
       where c.id = auth.uid() and c.role = 'admin' and c.active = true
    )
  );

drop policy if exists reports_select_admin on public.reports;
create policy reports_select_admin on public.reports
  for select using (
    exists (
      select 1 from public.companies c
       where c.id = auth.uid() and c.role = 'admin' and c.active = true
    )
  );
drop policy if exists reports_update_admin on public.reports;
create policy reports_update_admin on public.reports
  for update using (
    exists (
      select 1 from public.companies c
       where c.id = auth.uid() and c.role = 'admin' and c.active = true
    )
  );

drop policy if exists activity_logs_select_admin on public.activity_logs;
create policy activity_logs_select_admin on public.activity_logs
  for select using (
    exists (
      select 1 from public.companies c
       where c.id = auth.uid() and c.role = 'admin' and c.active = true
    )
  );

drop policy if exists messages_insert_self on public.messages;
create policy messages_insert_self on public.messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1
        from public.conversations cv
       where cv.id = messages.conversation_id
         and (cv.participant_a = auth.uid() or cv.participant_b = auth.uid())
    )
  );

drop policy if exists produtos_delete_owner on public.produtos;
drop policy if exists produtos_delete_admin on public.produtos;

drop policy if exists messages_update_self on public.messages;
create policy messages_update_self on public.messages
  for update
  using (
    sender_id <> auth.uid()
    and exists (
      select 1
        from public.conversations cv
       where cv.id = messages.conversation_id
         and (cv.participant_a = auth.uid() or cv.participant_b = auth.uid())
    )
  )
  with check (
    sender_id <> auth.uid()
    and exists (
      select 1
        from public.conversations cv
       where cv.id = messages.conversation_id
         and (cv.participant_a = auth.uid() or cv.participant_b = auth.uid())
    )
  );

create or replace function public.protect_message_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if old.sender_id = auth.uid()
    or new.id is distinct from old.id
    or new.conversation_id is distinct from old.conversation_id
    or new.sender_id is distinct from old.sender_id
    or new.content is distinct from old.content
    or new.created_at is distinct from old.created_at
    or (old.read and not new.read) then
    raise exception 'Mensagens não podem ser editadas; apenas o destinatário pode marcá-las como lidas.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_message_update on public.messages;
create trigger protect_message_update
before update on public.messages
for each row execute function public.protect_message_update();

drop policy if exists reviews_insert_self on public.reviews;
create policy reviews_insert_self on public.reviews
  for insert with check (
    reviewer_id = auth.uid()
    and company_id <> auth.uid()
  );

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.reviews'::regclass
       and conname = 'reviews_no_self_review'
  ) then
    alter table public.reviews
      add constraint reviews_no_self_review
      check (company_id <> reviewer_id) not valid;
  end if;
end;
$$;

create or replace function public.recalculate_company_rating(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_company_id is null then
    return;
  end if;

  update public.companies c
     set rating = coalesce((
           select round(avg(r.rating)::numeric, 2)::numeric(3,2)
             from public.reviews r
            where r.company_id = p_company_id
         ), 0),
         review_count = (
           select count(*)::integer
             from public.reviews r
            where r.company_id = p_company_id
         )
   where c.id = p_company_id;
end;
$$;

revoke all on function public.recalculate_company_rating(uuid)
  from public, anon, authenticated;

create or replace function public.sync_company_rating_from_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_company_rating(old.company_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.company_id is distinct from new.company_id then
    perform public.recalculate_company_rating(old.company_id);
  end if;

  perform public.recalculate_company_rating(new.company_id);
  return new;
end;
$$;

drop trigger if exists trg_sync_company_rating on public.reviews;
create trigger trg_sync_company_rating
after insert or update or delete on public.reviews
for each row execute function public.sync_company_rating_from_review();

update public.companies c
   set rating = coalesce((
         select round(avg(r.rating)::numeric, 2)::numeric(3,2)
           from public.reviews r
          where r.company_id = c.id
       ), 0),
       review_count = (
         select count(*)::integer
           from public.reviews r
          where r.company_id = c.id
       );

create or replace function public.notify_user(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text default null,
  p_link text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    return;
  end if;

  if exists (
    select 1
      from public.user_settings s
     where s.user_id = p_user_id
       and (
         (p_type = 'mensagem' and not s.notify_messages)
         or (p_type = 'interesse' and not s.notify_interests)
         or (p_type = 'negociacao' and not s.notify_negotiations)
       )
  ) then
    return;
  end if;

  insert into public.notifications (user_id, type, title, message, link, read)
  values (p_user_id, p_type, p_title, p_message, p_link, false);
end;
$$;

create or replace function public.increment_views(row_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if row_id is null then return; end if;
  update public.produtos p
     set views = p.views + 1,
         views_updated_at = now()
   where p.id = row_id
     and (p.views_updated_at is null or p.views_updated_at < now() - interval '30 seconds');
end;
$$;

revoke all on function public.increment_views(uuid) from public, anon, authenticated;
grant execute on function public.increment_views(uuid) to authenticated;

create or replace function public.log_user_activity(
  p_user_id uuid,
  p_action text,
  p_details text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    return;
  end if;

  insert into public.activity_logs (user_id, action, details)
  values (p_user_id, p_action, p_details);
end;
$$;

revoke all on function public.notify_user(uuid, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.log_user_activity(uuid, text, text)
  from public, anon, authenticated;

create or replace function public.on_report_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, type, title, message, link, read)
  select c.id, 'sistema', 'Nova denúncia pendente',
         'Um usuário reportou ' || new.target_type || '. Revise em "Painel Admin".',
         '/admin', false
    from public.companies c
   where c.role = 'admin' and c.active = true;
  return new;
end;
$$;

create or replace function public.admin_delete_company(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  if not exists (
    select 1
      from public.companies c
     where c.id = auth.uid()
       and c.role = 'admin'
       and c.active = true
  ) then
    raise exception 'Somente administradores ativos podem excluir empresas.'
      using errcode = '42501';
  end if;

  if p_company_id is null or p_company_id = auth.uid() then
    raise exception 'A conta administrativa atual não pode ser excluída por este fluxo.'
      using errcode = '22023';
  end if;

  delete from public.companies where id = p_company_id;
  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then
    raise exception 'Empresa não encontrada.' using errcode = 'P0002';
  end if;

  delete from auth.users where id = p_company_id;
end;
$$;

revoke all on function public.admin_delete_company(uuid) from public, anon;
grant execute on function public.admin_delete_company(uuid) to authenticated;

create or replace function public.admin_archive_product(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if not exists (
    select 1
      from public.companies c
     where c.id = auth.uid()
       and c.role = 'admin'
       and c.active = true
  ) then
    raise exception 'Somente administradores ativos podem arquivar produtos.'
      using errcode = '42501';
  end if;

  update public.produtos
     set status = 'inactive', updated_at = now()
   where id = p_product_id;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'Produto não encontrado.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_archive_product(uuid) from public, anon;
grant execute on function public.admin_archive_product(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'messages'
    ) then
      execute 'alter publication supabase_realtime add table public.messages';
    end if;

    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'notifications'
    ) then
      execute 'alter publication supabase_realtime add table public.notifications';
    end if;
  end if;
end;
$$;
