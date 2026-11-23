begin;

-- An unverified registration must not reserve a public company identifier.
alter table public.companies drop constraint if exists companies_cnpj_key;
create unique index companies_verified_cnpj_key on public.companies (
  (upper(regexp_replace(cnpj, '[^a-zA-Z0-9]', '', 'g')))
) where verified and nullif(btrim(cnpj), '') is not null;

create or replace function public.admin_set_company_verification(p_company_id uuid, p_identity_revision uuid, p_verified boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.admin_has_mfa() then
    raise exception 'Confirme a autenticação administrativa em dois fatores.' using errcode='42501';
  end if;

  update public.companies c set verified=p_verified, updated_at=pg_catalog.now()
  where c.id=p_company_id and c.identity_revision=p_identity_revision
    and (not p_verified or nullif(regexp_replace(c.cnpj,'[^a-zA-Z0-9]','','g'),'') is not null);
  if not found then
    raise exception 'Confira se o cadastro continua atualizado e tem um CNPJ preenchido.';
  end if;
end;
$$;

create index if not exists conversations_product_participants_idx on public.conversations(product_id,participant_a,participant_b);
create function public.guard_conversation_insert()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  recipient uuid;
begin
  if caller is null or caller not in (new.participant_a,new.participant_b)
    or new.participant_a=new.participant_b then
    raise exception 'Conversa indisponível.' using errcode='42501';
  end if;
  recipient := case when new.participant_a=caller then new.participant_b else new.participant_a end;
  if not exists (
    select 1 from public.produtos p where p.id=new.product_id and p.created_by=recipient and p.status='active'
  ) then
    raise exception 'Inicie a conversa pelo anúncio disponível do vendedor.' using errcode='42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'conversation:' || new.product_id::text || ':' || caller::text || ':' || recipient::text, 0));
  if exists (
    select 1 from public.conversations c where c.product_id=new.product_id and (
      (c.participant_a=caller and c.participant_b=recipient) or (c.participant_a=recipient and c.participant_b=caller)
    )
  ) then
    raise exception 'Já existe uma conversa sobre este anúncio.' using errcode='23505';
  end if;
  new.created_at := pg_catalog.clock_timestamp();
  new.updated_at := new.created_at;
  return new;
end;
$$;

create trigger guard_conversation_insert before insert on public.conversations
for each row execute function public.guard_conversation_insert();

create index if not exists messages_sender_recent_idx on public.messages(sender_id,created_at);
create function public.guard_message_rate()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare
  received_at timestamptz;
begin
  if auth.uid() is distinct from new.sender_id then
    raise exception 'Remetente inválido.' using errcode='42501';
  end if;
  if nullif(btrim(new.content),'') is null or length(new.content)>4000 then
    raise exception 'Envie uma mensagem de até 4.000 caracteres.' using errcode='23514';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('messages:' || new.sender_id::text,0));
  received_at := pg_catalog.clock_timestamp();
  if (select count(*) from public.messages m where m.sender_id=new.sender_id
    and m.created_at >= received_at - interval '1 minute') >= 30 then
    raise exception 'Aguarde um minuto antes de enviar mais mensagens.';
  end if;
  new.created_at := received_at;
  new.read := false;
  return new;
end;
$$;

create trigger guard_message_rate before insert on public.messages
for each row execute function public.guard_message_rate();

create function public.touch_message_conversation()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.conversations
  set updated_at = greatest(updated_at, new.created_at)
  where id = new.conversation_id;
  return new;
end;
$$;

revoke all on function public.touch_message_conversation() from public, anon, authenticated;
create trigger touch_message_conversation after insert on public.messages
for each row execute function public.touch_message_conversation();

create index if not exists reports_reporter_recent_idx on public.reports(reporter_id,created_at);
create function public.guard_report_target()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target uuid;
  visible boolean;
  received_at timestamptz;
begin
  if caller is null or new.reporter_id is distinct from caller or not public.is_current_company_active() then
    raise exception 'Conta indisponível.' using errcode='42501';
  end if;
  if new.target_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Alvo da denúncia indisponível.' using errcode='23514';
  end if;
  target := new.target_id::uuid;
  visible := case new.target_type
    when 'product' then exists(select 1 from public.produtos p where p.id=target and public.can_view_company_profile(p.created_by))
    when 'company' then exists(select 1 from public.companies c where c.id=target and public.can_view_company_profile(c.id))
    when 'message' then exists(select 1 from public.messages m join public.conversations c on c.id=m.conversation_id
      where m.id=target and caller in (c.participant_a,c.participant_b))
    else false end;
  if not visible then raise exception 'Alvo da denúncia indisponível.' using errcode='23514'; end if;
  if nullif(btrim(new.reason),'') is null or length(new.reason)>2000 then
    raise exception 'Descreva a denúncia em até 2.000 caracteres.' using errcode='23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reports:' || caller::text,0));
  received_at := pg_catalog.clock_timestamp();
  if exists(select 1 from public.reports r where r.reporter_id=caller and r.target_type=new.target_type
    and lower(r.target_id)=target::text and r.status in ('pending','reviewing')) then
    raise exception 'Já existe uma denúncia em andamento para este item.';
  end if;
  if (select count(*) from public.reports r where r.reporter_id=caller
    and r.created_at >= received_at-interval '1 hour') >= 10 then
    raise exception 'Aguarde antes de enviar mais denúncias.';
  end if;
  new.target_id := target::text;
  new.created_at := received_at;
  return new;
end;
$$;

revoke all on function public.guard_report_target() from public, anon, authenticated;
create trigger guard_report_target before insert on public.reports
for each row execute function public.guard_report_target();

commit;
