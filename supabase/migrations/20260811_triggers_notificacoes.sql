-- =====================================================================
--  REJET CORP — migration: notificações + log de atividades automáticos
--  Triggers geram notificações e atividades reais no banco.
-- =====================================================================

-- ---------------------------------------------------------------
--  Função auxiliar: notificar um usuário (security definer)
-- ---------------------------------------------------------------
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
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;
  insert into public.notifications (user_id, type, title, message, link, read)
  values (p_user_id, p_type, p_title, p_message, p_link, false);
end;
$$;

-- ---------------------------------------------------------------
--  Função auxiliar: registrar atividade (security definer)
-- ---------------------------------------------------------------
create or replace function public.log_user_activity(
  p_user_id uuid,
  p_action text,
  p_details text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;
  insert into public.activity_logs (user_id, action, details)
  values (p_user_id, p_action, p_details);
end;
$$;

-- ---------------------------------------------------------------
--  1. NEGOCIAÇÕES — novo interesse
-- ---------------------------------------------------------------
create or replace function public.on_negotiation_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product text;
begin
  select product into v_product from public.produtos where id = new.product_id;

  perform public.notify_user(
    new.seller_id, 'interesse',
    'Novo interesse recebido',
    'Sua empresa recebeu um interesse no produto "' || coalesce(v_product, '') || '".',
    '/negociacoes/' || new.id
  );

  perform public.log_user_activity(
    new.buyer_id, 'interesse_enviado',
    'Você demonstrou interesse no produto "' || coalesce(v_product, '') || '".'
  );

  return new;
end;
$$;

drop trigger if exists trg_negotiation_insert_notify on public.negotiations;
create trigger trg_negotiation_insert_notify
  after insert on public.negotiations
  for each row execute function public.on_negotiation_insert();

-- ---------------------------------------------------------------
--  2. NEGOCIAÇÕES — mudança de status
-- ---------------------------------------------------------------
create or replace function public.on_negotiation_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product text;
  v_other uuid;
begin
  if old.status = new.status then
    return new;
  end if;

  select product into v_product from public.produtos where id = new.product_id;

  -- quem mudou? notifica o outro participante
  v_other := case when auth.uid() = new.seller_id then new.buyer_id else new.seller_id end;

  case new.status
    when 'em_negociacao' then
      perform public.notify_user(v_other, 'negociacao', 'Negociação em andamento',
        'O status da negociação do produto "' || coalesce(v_product,'') || '" mudou para "Em negociação".',
        '/negociacoes/' || new.id);
    when 'aceito' then
      perform public.notify_user(v_other, 'negociacao', 'Interesse aceito!',
        'Sua negociação do produto "' || coalesce(v_product,'') || '" foi aceita.',
        '/negociacoes/' || new.id);
    when 'recusado' then
      perform public.notify_user(v_other, 'negociacao', 'Interesse recusado',
        'Sua negociação do produto "' || coalesce(v_product,'') || '" foi recusada.',
        '/negociacoes/' || new.id);
    when 'cancelado' then
      perform public.notify_user(v_other, 'negociacao', 'Negociação cancelada',
        'A negociação do produto "' || coalesce(v_product,'') || '" foi cancelada.',
        '/negociacoes/' || new.id);
    when 'finalizado' then
      perform public.notify_user(v_other, 'negociacao', 'Negociação finalizada!',
        'A negociação do produto "' || coalesce(v_product,'') || '" foi finalizada. Deixe sua avaliação!',
        '/negociacoes/' || new.id);
    else
      null;
  end case;

  perform public.log_user_activity(
    coalesce(auth.uid(), new.buyer_id), 'negociacao_status',
    'Negociação do produto "' || coalesce(v_product,'') || '" mudou para ' || new.status || '.'
  );

  return new;
end;
$$;

drop trigger if exists trg_negotiation_status_notify on public.negotiations;
create trigger trg_negotiation_status_notify
  after update of status on public.negotiations
  for each row execute function public.on_negotiation_status_change();

-- ---------------------------------------------------------------
--  3. MENSAGENS — nova mensagem
-- ---------------------------------------------------------------
create or replace function public.on_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_other uuid;
  v_product text;
begin
  select case
           when c.participant_a = new.sender_id then c.participant_b
           else c.participant_a
         end
    into v_other
    from public.conversations c
   where c.id = new.conversation_id;

  select p.product into v_product
    from public.conversations c
    left join public.produtos p on p.id = c.product_id
   where c.id = new.conversation_id;

  perform public.notify_user(v_other, 'mensagem', 'Nova mensagem',
    'Você recebeu uma mensagem sobre "' || coalesce(v_product, 'conversa') || '".',
    '/mensagens');

  return new;
end;
$$;

drop trigger if exists trg_message_insert_notify on public.messages;
create trigger trg_message_insert_notify
  after insert on public.messages
  for each row execute function public.on_message_insert();

-- ---------------------------------------------------------------
--  4. FAVORITOS — novo favorito no produto
-- ---------------------------------------------------------------
create or replace function public.on_favorite_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_product text;
begin
  select p.created_by, p.product into v_owner, v_product
    from public.produtos p where p.id = new.product_id;

  if v_owner is null or v_owner = new.user_id then
    return new;
  end if;

  perform public.notify_user(v_owner, 'aviso', 'Novo favorito',
    'Seu produto "' || coalesce(v_product, '') || '" foi adicionado aos favoritos de outra empresa.',
    '/produto/' || new.product_id);

  return new;
end;
$$;

drop trigger if exists trg_favorite_insert_notify on public.favorites;
create trigger trg_favorite_insert_notify
  after insert on public.favorites
  for each row execute function public.on_favorite_insert();

-- ---------------------------------------------------------------
--  5. AVALIAÇÕES — nova avaliação recebida
-- ---------------------------------------------------------------
create or replace function public.on_review_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reviewer_id <> new.company_id then
    perform public.notify_user(new.company_id, 'aviso', 'Nova avaliação recebida',
      'Uma empresa avaliou seu perfil com ' || new.rating || ' estrela(s).',
      '/perfil');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_review_insert_notify on public.reviews;
create trigger trg_review_insert_notify
  after insert on public.reviews
  for each row execute function public.on_review_insert();

-- ---------------------------------------------------------------
--  6. DENÚNCIAS — avisar administradores
-- ---------------------------------------------------------------
create or replace function public.on_report_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, message, link, read)
  select id, 'sistema', 'Nova denúncia pendente',
         'Um usuário reportou ' || new.target_type || '. Revise em "Painel Admin".',
         '/admin', false
    from public.companies
   where role = 'admin';
  return new;
end;
$$;

drop trigger if exists trg_report_insert_notify on public.reports;
create trigger trg_report_insert_notify
  after insert on public.reports
  for each row execute function public.on_report_insert();

-- ---------------------------------------------------------------
--  7. PRODUTOS — atividade de criação/atualização
-- ---------------------------------------------------------------
create or replace function public.on_product_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    perform public.log_user_activity(new.created_by, 'produto_cadastrado',
      'Você publicou o produto "' || new.product || '".');
    return new;
  end if;
  if TG_OP = 'UPDATE' then
    perform public.log_user_activity(new.created_by, 'produto_atualizado',
      'Você atualizou o produto "' || new.product || '".');
    return new;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_product_write_activity on public.produtos;
create trigger trg_product_write_activity
  after insert or update on public.produtos
  for each row execute function public.on_product_write();

-- ---------------------------------------------------------------
--  RLS: empresa pode ver o próprio histórico de atividades
-- ---------------------------------------------------------------
drop policy if exists "activity_logs_select_self" on public.activity_logs;
create policy "activity_logs_select_self"
  on public.activity_logs for select
  using (user_id = auth.uid());
