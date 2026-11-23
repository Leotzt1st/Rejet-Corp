-- =====================================================================
--  MIGRATION COMPLETA: Corrige schema + policies + negotiation_history
--  Execute este arquivo inteiro no SQL Editor do Supabase
--  Seguro para rodar múltiplas vezes (DROP IF EXISTS + CREATE OR REPLACE)
--  Instalação legada: aplique também as migrations de supabase/migrations em ordem.
-- =====================================================================

-- =====================================================================
--  1) TABELAS: garantir que existem com as colunas corretas
-- =====================================================================

-- companies (já deve existir, sem alteração)
-- categories, subcategories (sem alteração)
-- produtos (sem alteração)
-- favorites, conversations, messages (sem alteração)
-- negotiations (sem alteração)
-- notifications, reviews, reports, activity_logs, user_settings (sem alteração)

-- negotiation_history: garantir colunas corretas
do $$ begin
  alter table public.negotiation_history add column actor_id uuid references public.companies(id) on delete set null;
exception when duplicate_column then null;
end $$;

do $$ begin
  alter table public.negotiation_history add column previous_status text;
exception when duplicate_column then null;
end $$;

do $$ begin
  alter table public.negotiation_history add column new_status text not null default '';
exception when duplicate_column then null;
end $$;

do $$ begin
  alter table public.negotiation_history add column observation text;
exception when duplicate_column then null;
end $$;

-- Remover colunas antigas se existirem
do $$ begin
  alter table public.negotiation_history drop column if exists created_by;
exception when others then null;
end $$;

do $$ begin
  alter table public.negotiation_history drop column if exists status_from;
exception when others then null;
end $$;

do $$ begin
  alter table public.negotiation_history drop column if exists status_to;
exception when others then null;
end $$;

do $$ begin
  alter table public.negotiation_history drop column if exists note;
exception when others then null;
end $$;

-- =====================================================================
--  2) INDEXES (garantir que existem)
-- =====================================================================
create index if not exists produtos_created_by_idx on public.produtos(created_by);
create index if not exists produtos_status_idx on public.produtos(status);
create index if not exists produtos_category_idx on public.produtos(category);
create index if not exists messages_conversation_idx on public.messages(conversation_id, created_at);
create index if not exists negotiations_buyer_idx on public.negotiations(buyer_id);
create index if not exists negotiations_seller_idx on public.negotiations(seller_id);
create index if not exists notifications_user_idx on public.notifications(user_id, read);
create index if not exists negotiation_history_negotiation_idx on public.negotiation_history(negotiation_id, created_at);

-- =====================================================================
--  3) POLICIES: dropar todas e recriar (seguro para rodar múltiplas vezes)
-- =====================================================================

-- companies
drop policy if exists companies_select_auth on public.companies;
drop policy if exists companies_insert_self on public.companies;
drop policy if exists companies_update_self on public.companies;
drop policy if exists companies_update_admin on public.companies;

create policy "companies_insert_self" on public.companies
  for insert with check (id = auth.uid());
create policy "companies_update_self" on public.companies
  for update using (id = auth.uid());
create policy "companies_update_admin" on public.companies
  for update using (
    exists (select 1 from public.companies c where c.id = auth.uid() and c.role = 'admin')
  );

-- categories
drop policy if exists categories_select_auth on public.categories;
drop policy if exists categories_insert_admin on public.categories;
drop policy if exists categories_update_admin on public.categories;
drop policy if exists categories_delete_admin on public.categories;

create policy "categories_select_auth" on public.categories
  for select using (auth.role() = 'authenticated');
create policy "categories_insert_admin" on public.categories
  for insert with check (
    exists (select 1 from public.companies c where c.id = auth.uid() and c.role = 'admin')
  );
create policy "categories_update_admin" on public.categories
  for update using (
    exists (select 1 from public.companies c where c.id = auth.uid() and c.role = 'admin')
  );
create policy "categories_delete_admin" on public.categories
  for delete using (
    exists (select 1 from public.companies c where c.id = auth.uid() and c.role = 'admin')
  );

-- subcategories
drop policy if exists subcategories_select_auth on public.subcategories;
drop policy if exists subcategories_insert_admin on public.subcategories;
drop policy if exists subcategories_delete_admin on public.subcategories;

create policy "subcategories_select_auth" on public.subcategories
  for select using (auth.role() = 'authenticated');
create policy "subcategories_insert_admin" on public.subcategories
  for insert with check (
    exists (select 1 from public.companies c where c.id = auth.uid() and c.role = 'admin')
  );
create policy "subcategories_delete_admin" on public.subcategories
  for delete using (
    exists (select 1 from public.companies c where c.id = auth.uid() and c.role = 'admin')
  );

-- produtos
drop policy if exists produtos_select_auth on public.produtos;
drop policy if exists produtos_insert_owner on public.produtos;
drop policy if exists produtos_update_owner on public.produtos;
drop policy if exists produtos_delete_owner on public.produtos;
drop policy if exists produtos_delete_admin on public.produtos;

create policy "produtos_insert_owner" on public.produtos
  for insert with check (created_by = auth.uid());
create policy "produtos_update_owner" on public.produtos
  for update using (created_by = auth.uid());
create policy "produtos_delete_owner" on public.produtos
  for delete using (created_by = auth.uid());
create policy "produtos_delete_admin" on public.produtos
  for delete using (
    exists (select 1 from public.companies c where c.id = auth.uid() and c.role = 'admin')
  );

-- favorites
drop policy if exists favorites_select_self on public.favorites;
drop policy if exists favorites_insert_self on public.favorites;
drop policy if exists favorites_delete_self on public.favorites;

create policy "favorites_select_self" on public.favorites
  for select using (user_id = auth.uid());
create policy "favorites_insert_self" on public.favorites
  for insert with check (user_id = auth.uid());
create policy "favorites_delete_self" on public.favorites
  for delete using (user_id = auth.uid());

-- conversations
drop policy if exists conversations_select_self on public.conversations;
drop policy if exists conversations_insert_self on public.conversations;
drop policy if exists conversations_update_self on public.conversations;

create policy "conversations_select_self" on public.conversations
  for select using (participant_a = auth.uid() or participant_b = auth.uid());
create policy "conversations_insert_self" on public.conversations
  for insert with check (participant_a = auth.uid() or participant_b = auth.uid());
-- messages
drop policy if exists messages_select_self on public.messages;
drop policy if exists messages_insert_self on public.messages;
drop policy if exists messages_update_self on public.messages;

create policy "messages_select_self" on public.messages
  for select using (
    exists (
      select 1 from public.conversations cv
      where cv.id = messages.conversation_id
        and (cv.participant_a = auth.uid() or cv.participant_b = auth.uid())
    )
  );
create policy "messages_insert_self" on public.messages
  for insert with check (sender_id = auth.uid());
create policy "messages_update_self" on public.messages
  for update using (
    exists (
      select 1 from public.conversations cv
      where cv.id = messages.conversation_id
        and (cv.participant_a = auth.uid() or cv.participant_b = auth.uid())
    )
  );

-- negotiations
drop policy if exists negotiations_select_self on public.negotiations;
drop policy if exists negotiations_insert_self on public.negotiations;
drop policy if exists negotiations_update_self on public.negotiations;
drop policy if exists negotiations_delete_self on public.negotiations;

create policy "negotiations_select_self" on public.negotiations
  for select using (buyer_id = auth.uid() or seller_id = auth.uid());
create policy "negotiations_insert_self" on public.negotiations
  for insert to authenticated with check (
    buyer_id = auth.uid()
    and seller_id <> auth.uid()
    and status = 'interesse'
    and exists (
      select 1 from public.produtos p
       where p.id = negotiations.product_id
         and p.created_by = negotiations.seller_id
         and p.status = 'active'
    )
  );
create policy "negotiations_update_self" on public.negotiations
  for update to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid())
  with check (buyer_id = auth.uid() or seller_id = auth.uid());
create policy "negotiations_delete_self" on public.negotiations
  for delete using (buyer_id = auth.uid());

-- negotiation_history
drop policy if exists negotiation_history_select_participant on public.negotiation_history;

create policy "negotiation_history_select_participant" on public.negotiation_history
  for select using (
    exists (
      select 1 from public.negotiations n
      where n.id = negotiation_history.negotiation_id
        and (n.buyer_id = auth.uid() or n.seller_id = auth.uid())
    )
  );

-- notifications
drop policy if exists notifications_select_self on public.notifications;
drop policy if exists notifications_insert_self on public.notifications;
drop policy if exists notifications_update_self on public.notifications;
drop policy if exists notifications_delete_self on public.notifications;

create policy "notifications_select_self" on public.notifications
  for select using (user_id = auth.uid());
create policy "notifications_insert_self" on public.notifications
  for insert with check (user_id = auth.uid());
create policy "notifications_update_self" on public.notifications
  for update using (user_id = auth.uid());
create policy "notifications_delete_self" on public.notifications
  for delete using (user_id = auth.uid());

-- reviews
drop policy if exists reviews_select_auth on public.reviews;
drop policy if exists reviews_insert_self on public.reviews;
drop policy if exists reviews_update_self on public.reviews;

create policy "reviews_select_auth" on public.reviews
  for select using (auth.role() = 'authenticated');
create policy "reviews_insert_self" on public.reviews
  for insert with check (reviewer_id = auth.uid());
create policy "reviews_update_self" on public.reviews
  for update using (reviewer_id = auth.uid());

-- reports
drop policy if exists reports_select_admin on public.reports;
drop policy if exists reports_insert_self on public.reports;
drop policy if exists reports_update_admin on public.reports;

create policy "reports_select_admin" on public.reports
  for select using (
    exists (select 1 from public.companies c where c.id = auth.uid() and c.role = 'admin')
  );
create policy "reports_insert_self" on public.reports
  for insert with check (reporter_id = auth.uid());
create policy "reports_update_admin" on public.reports
  for update using (
    exists (select 1 from public.companies c where c.id = auth.uid() and c.role = 'admin')
  );

-- activity_logs
drop policy if exists activity_logs_select_admin on public.activity_logs;
drop policy if exists activity_logs_select_self on public.activity_logs;
drop policy if exists activity_logs_insert_self on public.activity_logs;

create policy "activity_logs_select_admin" on public.activity_logs
  for select using (
    exists (select 1 from public.companies c where c.id = auth.uid() and c.role = 'admin')
  );
create policy "activity_logs_select_self" on public.activity_logs
  for select using (user_id = auth.uid());
create policy "activity_logs_insert_self" on public.activity_logs
  for insert with check (user_id = auth.uid());

-- user_settings
drop policy if exists user_settings_select_self on public.user_settings;
drop policy if exists user_settings_insert_self on public.user_settings;
drop policy if exists user_settings_update_self on public.user_settings;

create policy "user_settings_select_self" on public.user_settings
  for select using (user_id = auth.uid());
create policy "user_settings_insert_self" on public.user_settings
  for insert with check (user_id = auth.uid());
create policy "user_settings_update_self" on public.user_settings
  for update using (user_id = auth.uid());

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

create policy "companies_select_auth" on public.companies
  for select using (
    auth.role() = 'authenticated'
    and public.can_view_company_profile(id)
  );

create policy "produtos_select_auth" on public.produtos
  for select using (
    auth.role() = 'authenticated'
    and public.is_current_company_active()
    and public.can_view_company_profile(created_by)
  );

-- Suspended accounts may read their own company row to display the block notice.
-- These restrictive policies also block direct API access around the React route.
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

  -- Keep companies INSERT available for first-time profile creation after signup.
  foreach v_table in array array[
    'categories', 'subcategories', 'produtos', 'favorites',
    'conversations', 'messages', 'negotiations', 'negotiation_history',
    'notifications', 'reviews', 'reports', 'activity_logs', 'user_settings'
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

  execute 'alter table public.companies enable row level security';
  execute 'drop policy if exists require_active_company_update on public.companies';
  execute 'create policy require_active_company_update on public.companies as restrictive for update to authenticated using (public.is_current_company_active()) with check (public.is_current_company_active())';
  execute 'drop policy if exists require_active_company_delete on public.companies';
  execute 'create policy require_active_company_delete on public.companies as restrictive for delete to authenticated using (public.is_current_company_active())';
end;
$$;

-- =====================================================================
--  4) FUNÇÕES E TRIGGERS (CREATE OR REPLACE = seguro)
-- =====================================================================

create or replace function public.increment_views(row_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if row_id is null then return; end if;
  update public.produtos
     set views = views + 1, views_updated_at = now()
   where id = row_id
     and (views_updated_at is null or views_updated_at < now() - interval '30 seconds');
end; $$;

revoke all on function public.increment_views(uuid) from public;
grant execute on function public.increment_views(uuid) to authenticated;

create or replace function public.notify_user(
  p_user_id uuid, p_type text, p_title text,
  p_message text default null, p_link text default null
) returns void language plpgsql security definer set search_path = public
as $$
begin
  if p_user_id is null then return; end if;
  insert into public.notifications (user_id, type, title, message, link, read)
  values (p_user_id, p_type, p_title, p_message, p_link, false);
end; $$;

create or replace function public.log_user_activity(
  p_user_id uuid, p_action text, p_details text default null
) returns void language plpgsql security definer set search_path = public
as $$
begin
  if p_user_id is null then return; end if;
  insert into public.activity_logs (user_id, action, details) values (p_user_id, p_action, p_details);
end; $$;

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

-- Trigger: negociação criada
create or replace function public.on_negotiation_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_product text;
begin
  select product into v_product from public.produtos where id = new.product_id;
  perform public.notify_user(new.seller_id, 'interesse', 'Novo interesse recebido',
    'Sua empresa recebeu um interesse no produto "' || coalesce(v_product,'') || '".', '/negociacoes/' || new.id);
  perform public.log_user_activity(new.buyer_id, 'interesse_enviado',
    'Você demonstrou interesse no produto "' || coalesce(v_product,'') || '".');
  return new;
end; $$;

drop trigger if exists trg_negotiation_insert_notify on public.negotiations;
create trigger trg_negotiation_insert_notify
  after insert on public.negotiations
  for each row execute function public.on_negotiation_insert();

-- Trigger: status da negociação muda
create or replace function public.on_negotiation_status_change()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_product text; v_other uuid;
begin
  if old.status = new.status then return new; end if;
  select product into v_product from public.produtos where id = new.product_id;
  v_other := case when auth.uid() = new.seller_id then new.buyer_id else new.seller_id end;
  case new.status
    when 'em_negociacao' then
      perform public.notify_user(v_other, 'negociacao', 'Negociação em andamento',
        'O status da negociação do produto "' || coalesce(v_product,'') || '" mudou para "Em negociação".', '/negociacoes/' || new.id);
    when 'aceito' then
      perform public.notify_user(v_other, 'negociacao', 'Interesse aceito!',
        'Sua negociação do produto "' || coalesce(v_product,'') || '" foi aceita.', '/negociacoes/' || new.id);
    when 'recusado' then
      perform public.notify_user(v_other, 'negociacao', 'Interesse recusado',
        'Sua negociação do produto "' || coalesce(v_product,'') || '" foi recusada.', '/negociacoes/' || new.id);
    when 'cancelado' then
      perform public.notify_user(v_other, 'negociacao', 'Negociação cancelada',
        'A negociação do produto "' || coalesce(v_product,'') || '" foi cancelada.', '/negociacoes/' || new.id);
    when 'finalizado' then
      perform public.notify_user(v_other, 'negociacao', 'Negociação finalizada!',
        'A negociação do produto "' || coalesce(v_product,'') || '" foi finalizada.', '/negociacoes/' || new.id);
    else null;
  end case;
  perform public.log_user_activity(coalesce(auth.uid(), new.buyer_id), 'negociacao_status',
    'Negociação do produto "' || coalesce(v_product,'') || '" mudou para ' || new.status || '.');
  return new;
end; $$;

drop trigger if exists trg_negotiation_status_notify on public.negotiations;
create trigger trg_negotiation_status_notify
  after update of status on public.negotiations
  for each row execute function public.on_negotiation_status_change();

-- Trigger: histórico
create or replace function public.record_negotiation_history()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.negotiation_history (negotiation_id, actor_id, previous_status, new_status, observation)
  values (new.id, coalesce(auth.uid(), new.buyer_id), old.status, new.status, null);
  return new;
end; $$;

drop trigger if exists trg_negotiation_history on public.negotiations;
create trigger trg_negotiation_history
  after insert or update of status on public.negotiations
  for each row execute function public.record_negotiation_history();

-- Trigger: mensagem
create or replace function public.on_message_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_other uuid; v_product text;
begin
  select case when c.participant_a = new.sender_id then c.participant_b else c.participant_a end
    into v_other from public.conversations c where c.id = new.conversation_id;
  select p.product into v_product
    from public.conversations c left join public.produtos p on p.id = c.product_id
   where c.id = new.conversation_id;
  perform public.notify_user(v_other, 'mensagem', 'Nova mensagem',
    'Você recebeu uma mensagem sobre "' || coalesce(v_product, 'conversa') || '".', '/mensagens');
  return new;
end; $$;

drop trigger if exists trg_message_insert_notify on public.messages;
create trigger trg_message_insert_notify
  after insert on public.messages
  for each row execute function public.on_message_insert();

-- Trigger: favorito
create or replace function public.on_favorite_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_owner uuid; v_product text;
begin
  select p.created_by, p.product into v_owner, v_product from public.produtos p where p.id = new.product_id;
  if v_owner is null or v_owner = new.user_id then return new; end if;
  perform public.notify_user(v_owner, 'aviso', 'Novo favorito',
    'Seu produto "' || coalesce(v_product,'') || '" foi adicionado aos favoritos de outra empresa.', '/produto/' || new.product_id);
  return new;
end; $$;

drop trigger if exists trg_favorite_insert_notify on public.favorites;
create trigger trg_favorite_insert_notify
  after insert on public.favorites
  for each row execute function public.on_favorite_insert();

-- Trigger: avaliação
create or replace function public.on_review_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.reviewer_id <> new.company_id then
    perform public.notify_user(new.company_id, 'aviso', 'Nova avaliação recebida',
      'Uma empresa avaliou seu perfil com ' || new.rating || ' estrela(s).', '/perfil');
  end if;
  return new;
end; $$;

drop trigger if exists trg_review_insert_notify on public.reviews;
create trigger trg_review_insert_notify
  after insert on public.reviews
  for each row execute function public.on_review_insert();

-- Trigger: denúncia
create or replace function public.on_report_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, message, link, read)
  select id, 'sistema', 'Nova denúncia pendente',
         'Um usuário reportou ' || new.target_type || '. Revise em "Painel Admin".', '/admin', false
    from public.companies where role = 'admin';
  return new;
end; $$;

drop trigger if exists trg_report_insert_notify on public.reports;
create trigger trg_report_insert_notify
  after insert on public.reports
  for each row execute function public.on_report_insert();

-- Trigger: produto
create or replace function public.on_product_write()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    perform public.log_user_activity(new.created_by, 'produto_cadastrado', 'Você publicou o produto "' || new.product || '".');
    return new;
  end if;
  if TG_OP = 'UPDATE' then
    perform public.log_user_activity(new.created_by, 'produto_atualizado', 'Você atualizou o produto "' || new.product || '".');
    return new;
  end if;
  return new;
end; $$;

drop trigger if exists trg_product_write_activity on public.produtos;
create trigger trg_product_write_activity
  after insert or update on public.produtos
  for each row execute function public.on_product_write();

-- =====================================================================
--  5) STORAGE
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('produtos', 'produtos', true)
on conflict (id) do nothing;

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

-- =====================================================================
--  6) SEEDS
-- =====================================================================
insert into public.categories (name, slug, icon) values
  ('Plástico', 'plastico', '♻️'),
  ('Metal', 'metal', '🏗️'),
  ('Papel e Papelão', 'papel-papelao', '📦'),
  ('Vidro', 'vidro', '🫙'),
  ('Madeira', 'madeira', '🪵'),
  ('Eletrônicos', 'eletronicos', '🔌'),
  ('Químicos', 'quimicos', '⚗️'),
  ('Orgânicos', 'organicos', '🌱'),
  ('Têxteis', 'texteis', '🧵'),
  ('Outros', 'outros', '📦')
on conflict (name) do nothing;
