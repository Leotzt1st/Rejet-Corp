begin;

create table public.finance_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  commission_bps integer check (commission_bps between 0 and 10000),
  methods text[] not null default array['card'] check (
    cardinality(methods) between 1 and 2 and methods <@ array['card','pix']::text[]
  ),
  reverse_commission boolean not null default true
);
insert into public.finance_settings default values;

create table public.finance_sellers (
  company_id uuid not null references public.companies(id),
  livemode boolean not null,
  account_id text not null check (account_id ~ '^acct_[A-Za-z0-9]+$'),
  primary key (company_id, livemode),
  unique (account_id, livemode)
);

create table public.finance_orders (
  id uuid primary key default gen_random_uuid(),
  negotiation_id uuid not null unique references public.negotiations(id),
  product_id uuid not null unique references public.produtos(id),
  buyer_id uuid not null references public.companies(id),
  seller_id uuid not null references public.companies(id),
  material text not null,
  quantity numeric not null check (quantity > 0),
  unit text not null,
  amount_cents integer not null check (amount_cents between 1 and 99999999),
  commission_bps integer not null check (commission_bps between 0 and 10000),
  commission_cents integer not null check (commission_cents between 0 and amount_cents),
  reverse_commission boolean not null,
  gateway_fee_cents integer check (gateway_fee_cents >= 0),
  refunded_cents integer not null default 0 check (refunded_cents between 0 and amount_cents),
  commission_reversed_cents integer check (commission_reversed_cents between 0 and commission_cents),
  order_status text not null default 'awaiting_payment' check (order_status in (
    'awaiting_payment','paid','preparing','shipped','delivered','cancelled','disputed'
  )),
  payment_status text not null default 'pending' check (payment_status in (
    'pending','processing','approved','declined','cancelled','expired','partially_refunded','refunded','disputed'
  )),
  payment_method text check (payment_method in ('card','pix','boleto')),
  gateway_live boolean,
  gateway_account text,
  gateway_session text unique,
  gateway_payment text unique,
  gateway_fee_id text,
  checkout_started_at timestamptz,
  paid_at timestamptz,
  received_at timestamptz,
  received_by uuid references public.companies(id),
  refund_deadline_at timestamptz,
  tracking text,
  shipment_evidence text,
  created_at timestamptz not null default now(),
  check (buyer_id <> seller_id),
  check ((received_at is null and received_by is null and refund_deadline_at is null)
    or (received_at is not null and received_by = buyer_id and refund_deadline_at = received_at + interval '168 hours'))
);
create index finance_orders_buyer on public.finance_orders (buyer_id, created_at desc);
create index finance_orders_seller on public.finance_orders (seller_id, created_at desc);

create table public.finance_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.finance_orders(id),
  requested_by uuid not null references public.companies(id),
  amount_cents integer not null check (amount_cents > 0),
  reason text not null check (reason in (
    'not_received','not_as_described','quality','damaged','quantity','duplicate_payment','cancelled','other'
  )),
  description text not null check (length(description) between 1 and 2000),
  evidence_path text,
  status text not null default 'requested' check (status in (
    'requested','reviewing','approved','rejected','processing','succeeded','failed','cancelled'
  )),
  decision text,
  decided_by uuid references public.companies(id),
  gateway_refund text unique,
  gateway_started_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index finance_one_open_refund on public.finance_refunds (order_id)
  where status in ('requested','reviewing','approved','processing');
create index finance_refunds_order on public.finance_refunds (order_id, created_at desc);

create table public.finance_disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.finance_orders(id),
  opened_by uuid references public.companies(id),
  gateway_dispute text unique,
  description text not null check (length(description) between 1 and 2000),
  status text not null default 'open' check (status in ('open','closed','won','lost')),
  resolution text,
  created_at timestamptz not null default now()
);
create unique index finance_one_local_dispute on public.finance_disputes (order_id)
  where status = 'open' and gateway_dispute is null;

create table public.finance_payouts (
  gateway_payout text not null,
  seller_id uuid not null references public.companies(id),
  gateway_live boolean not null,
  amount_cents integer not null check (amount_cents > 0),
  status text not null check (status in ('pending','in_transit','paid','failed','canceled')),
  arrival_at timestamptz,
  observed_at bigint not null,
  primary key (gateway_payout, gateway_live)
);

create table public.finance_events (
  id bigint generated always as identity primary key,
  order_id uuid references public.finance_orders(id),
  actor_id uuid references public.companies(id),
  kind text not null,
  details jsonb not null default '{}',
  provider_key text unique,
  created_at timestamptz not null default now()
);
create index finance_events_order on public.finance_events (order_id, id desc);

create function public.finance_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists(select 1 from public.companies c where c.id = auth.uid() and c.active and c.role = 'admin');
$$;

create function public.finance_can_read(p_order uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists(select 1 from public.companies c where c.id = auth.uid() and c.active)
    and (public.finance_admin() or exists (
      select 1 from public.finance_orders o where o.id = p_order and auth.uid() in (o.buyer_id,o.seller_id)
    ));
$$;

alter table public.finance_settings enable row level security;
alter table public.finance_sellers enable row level security;
alter table public.finance_orders enable row level security;
alter table public.finance_refunds enable row level security;
alter table public.finance_disputes enable row level security;
alter table public.finance_payouts enable row level security;
alter table public.finance_events enable row level security;
revoke all on public.finance_settings, public.finance_sellers, public.finance_orders, public.finance_refunds,
  public.finance_disputes, public.finance_payouts, public.finance_events from public, anon, authenticated;
grant select on public.finance_settings, public.finance_sellers, public.finance_orders, public.finance_refunds,
  public.finance_disputes, public.finance_payouts, public.finance_events to authenticated;
create policy finance_admin_settings on public.finance_settings for select to authenticated using (public.finance_admin());
create policy finance_seller_link on public.finance_sellers for select to authenticated
  using (public.finance_admin() or (company_id = auth.uid() and public.is_current_company_active()));
create policy finance_order_read on public.finance_orders for select to authenticated using (public.finance_can_read(id));
create policy finance_refund_read on public.finance_refunds for select to authenticated using (public.finance_can_read(order_id));
create policy finance_dispute_read on public.finance_disputes for select to authenticated using (public.finance_can_read(order_id));
create policy finance_payout_read on public.finance_payouts for select to authenticated
  using (public.finance_admin() or (seller_id = auth.uid() and public.is_current_company_active()));
create policy finance_event_read on public.finance_events for select to authenticated
  using (public.finance_admin() or (order_id is not null and public.finance_can_read(order_id)));

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('finance-evidence','finance-evidence',false,5242880,array['application/pdf','image/jpeg','image/png']);
create policy finance_evidence_read on storage.objects for select to authenticated using (
  bucket_id = 'finance-evidence' and exists (
    select 1 from public.finance_orders o where o.id::text = (storage.foldername(name))[1]
  )
);
create policy finance_evidence_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'finance-evidence' and cardinality(storage.foldername(name)) = 2
  and (storage.foldername(name))[2] = auth.uid()::text
  and public.is_current_company_active() and exists (
    select 1 from public.finance_orders o
    where o.id::text = (storage.foldername(name))[1] and auth.uid() in (o.buyer_id,o.seller_id)
  )
);

create function public.finance_record(
  p_order uuid, p_actor uuid, p_kind text, p_details jsonb, p_title text default null
) returns void language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.finance_events(order_id,actor_id,kind,details) values(p_order,p_actor,p_kind,p_details);
  if p_title is not null and p_order is not null then
    insert into public.notifications(user_id,type,title,link)
    select party,'sistema',p_title,'/financeiro?pedido=' || o.id
    from public.finance_orders o cross join lateral (
      select o.buyer_id as party union select o.seller_id
      union select c.id from public.companies c where c.role = 'admin' and c.active
        and p_kind in ('refund_requested','dispute_opened')
    ) recipients where o.id = p_order;
  end if;
end;
$$;

create function public.finance_evidence_path(p_path text, p_order uuid, p_user uuid)
returns text language plpgsql security definer set search_path = ''
as $$
begin
  if nullif(p_path,'') is null then return null; end if;
  if not exists(select 1 from storage.objects s where s.bucket_id = 'finance-evidence'
    and s.name = p_path and (storage.foldername(s.name)) = array[p_order::text,p_user::text])
  then raise exception 'Comprovante inválido.'; end if;
  return p_path;
end;
$$;

create function public.finance_in_refund_window(p_received timestamptz,p_deadline timestamptz,p_now timestamptz)
returns boolean language sql immutable set search_path = ''
as $$
  select p_received is not null and p_deadline is not null and p_now between p_received and p_deadline;
$$;

create function public.finance_offer(p_negotiation uuid, p_buyer uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  n public.negotiations%rowtype;
  p public.produtos%rowtype;
  s public.finance_settings%rowtype;
  qty numeric;
  total numeric;
begin
  select * into n from public.negotiations where id = p_negotiation for update;
  if not found or n.buyer_id <> p_buyer or n.status <> 'aceito'
    then raise exception 'Abra uma negociação aceita como comprador.'; end if;
  select * into p from public.produtos where id = n.product_id for update;
  select * into s from public.finance_settings where singleton for share;
  if not s.enabled or s.commission_bps is null then raise exception 'Pagamentos ainda não configurados.'; end if;
  if p.created_by is distinct from n.seller_id
    or not exists(select 1 from public.companies where id = n.seller_id and active)
  then raise exception 'O vendedor não está disponível.'; end if;
  qty := coalesce(n.quantity,p.quantities);
  total := round(qty * coalesce(n.offered_price,p.price) * 100);
  if qty is null or qty <= 0 or qty::text in ('NaN','Infinity','-Infinity')
    or (p.quantities is not null and qty > p.quantities)
    or total is null or total not between 1 and 99999999 or p.is_free
  then raise exception 'Revise o preço e a quantidade negociados.'; end if;
  return jsonb_build_object(
    'product_id',p.id,'seller_id',n.seller_id,'material',p.product,'unit',p.unit,'quantity',qty,
    'amount_cents',total::integer,'commission_bps',s.commission_bps,
    'commission_cents',round(total * s.commission_bps / 10000)::integer,'reverse_commission',s.reverse_commission
  );
end;
$$;

create function public.finance_command(p_action text,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  admin boolean := public.finance_admin();
  o public.finance_orders%rowtype;
  f public.finance_refunds%rowtype;
  d public.finance_disputes%rowtype;
  s public.finance_settings%rowtype;
  offer jsonb;
  previous_config jsonb;
  target uuid;
  ts timestamptz;
  text_value text := nullif(btrim(p_data->>'description'),'');
  amount integer;
  state text;
begin
  if actor is null or not public.is_current_company_active() then
    raise exception 'Sessão ou empresa indisponível.' using errcode = '42501';
  end if;

  if p_action = 'settings' then
    if not admin then raise exception 'Acesso administrativo necessário.' using errcode = '42501'; end if;
    select * into s from public.finance_settings where singleton for update;
    previous_config := to_jsonb(s);
    update public.finance_settings set
      enabled = (p_data->>'enabled')::boolean,
      commission_bps = (p_data->>'commission_bps')::integer,
      methods = array(select jsonb_array_elements_text(p_data->'methods')),
      reverse_commission = (p_data->>'reverse_commission')::boolean
    where singleton
    returning * into s;
    if s.enabled and s.commission_bps is null then raise exception 'Defina a comissão antes de habilitar.'; end if;
    perform public.finance_record(null,actor,'settings_changed',jsonb_build_object('before',previous_config,'after',to_jsonb(s)));
    return to_jsonb(s);
  end if;

  if p_action in ('quote','open') then
    target := (p_data->>'negotiation_id')::uuid;
    select * into o from public.finance_orders where negotiation_id = target and buyer_id = actor;
    if found then return jsonb_build_object('order_id',o.id); end if;
    offer := public.finance_offer(target,actor);
    select * into o from public.finance_orders where negotiation_id = target and buyer_id = actor;
    if found then return jsonb_build_object('order_id',o.id); end if;
    if p_action = 'quote' then return offer; end if;
    if (offer->>'amount_cents')::integer is distinct from (p_data->>'amount_cents')::integer
      or (offer->>'commission_bps')::integer is distinct from (p_data->>'commission_bps')::integer
      then raise exception 'A condição comercial mudou. Atualize a cotação.'; end if;
    insert into public.finance_orders(negotiation_id,product_id,buyer_id,seller_id,material,unit,quantity,
      amount_cents,commission_bps,commission_cents,reverse_commission)
    values(target,(offer->>'product_id')::uuid,actor,(offer->>'seller_id')::uuid,offer->>'material',offer->>'unit',
      (offer->>'quantity')::numeric,(offer->>'amount_cents')::integer,(offer->>'commission_bps')::integer,
      (offer->>'commission_cents')::integer,(offer->>'reverse_commission')::boolean)
    returning * into o;
    perform public.finance_record(o.id,actor,'order_created','{}','Pedido criado. Aguardando pagamento.');
    return jsonb_build_object('order_id',o.id);
  end if;

  select * into o from public.finance_orders where id = (p_data->>'order_id')::uuid for update;
  if not found or (not admin and actor not in (o.buyer_id,o.seller_id)) then
    raise exception 'Pedido indisponível.' using errcode = '42501';
  end if;

  if p_action in ('prepare','ship') then
    if actor <> o.seller_id or o.payment_status not in ('approved','partially_refunded')
      or (p_action = 'prepare' and o.order_status <> 'paid')
      or (p_action = 'ship' and o.order_status not in ('paid','preparing')) then
      raise exception 'O pedido não permite esta ação.';
    end if;
    state := case when p_action = 'ship' then 'shipped' else 'preparing' end;
    update public.finance_orders set order_status = state,
      tracking = case when p_action = 'ship' then left(nullif(btrim(p_data->>'tracking'),''),300) else tracking end,
      shipment_evidence = case when p_action = 'ship' then public.finance_evidence_path(p_data->>'evidence_path',o.id,actor) else shipment_evidence end
    where id = o.id;
    perform public.finance_record(o.id,actor,state,'{}',case when state = 'shipped' then 'Material enviado. Confira a entrega.' else 'Material em preparação.' end);
  elsif p_action = 'receive' then
    if actor <> o.buyer_id then raise exception 'Somente o comprador confirma a entrega.' using errcode = '42501'; end if;
    if o.received_at is not null then return jsonb_build_object('received_at',o.received_at,'deadline',o.refund_deadline_at); end if;
    if o.order_status <> 'shipped' or o.payment_status not in ('approved','partially_refunded') then raise exception 'Entrega indisponível para confirmação.'; end if;
    ts := clock_timestamp();
    update public.finance_orders set order_status = 'delivered', received_at = ts, received_by = actor,
      refund_deadline_at = ts + interval '168 hours' where id = o.id;
    perform public.finance_record(o.id,actor,'received',jsonb_build_object('deadline',ts + interval '168 hours'),
      'Recebimento confirmado. O prazo comercial de reembolso começou.');
    return jsonb_build_object('received_at',ts,'deadline',ts + interval '168 hours');
  elsif p_action in ('refund_request','refund_exception') then
    if (p_action = 'refund_request' and (actor <> o.buyer_id
      or not public.finance_in_refund_window(o.received_at,o.refund_deadline_at,clock_timestamp()) or o.order_status <> 'delivered'))
      or (p_action = 'refund_exception' and not admin) then
      raise exception 'A solicitação exige um pedido elegível ou uma exceção administrativa.';
    end if;
    if (p_action = 'refund_exception' and text_value is null) or o.payment_status not in ('approved','partially_refunded')
      or o.payment_method is null or o.payment_method = 'boleto' then raise exception 'Este pagamento não permite estorno automático.'; end if;
    amount := (p_data->>'amount_cents')::integer;
    if amount is null or amount <= 0 or amount > o.amount_cents - o.refunded_cents then raise exception 'Valor acima do saldo reembolsável ou inválido.'; end if;
    if exists(select 1 from public.finance_refunds where order_id=o.id and status in ('requested','reviewing','approved','processing')) then
      raise exception 'Já existe uma solicitação em andamento.';
    end if;
    insert into public.finance_refunds(order_id,requested_by,amount_cents,reason,description,evidence_path)
    values(o.id,actor,amount,p_data->>'reason',text_value,public.finance_evidence_path(p_data->>'evidence_path',o.id,actor))
    returning * into f;
    perform public.finance_record(o.id,actor,'refund_requested',jsonb_build_object('refund_id',f.id,'exception',p_action='refund_exception'),
      'Solicitação de reembolso registrada.');
    return jsonb_build_object('refund_id',f.id);
  elsif p_action in ('refund_review','refund_approve','refund_reject') then
    if not admin or text_value is null or length(text_value) > 2000 then
      raise exception 'Indique uma justificativa administrativa.';
    end if;
    select * into f from public.finance_refunds where id=(p_data->>'refund_id')::uuid and order_id=o.id for update;
    if not found or f.status not in ('requested','reviewing') then raise exception 'Solicitação já analisada ou indisponível.'; end if;
    state := case p_action when 'refund_review' then 'reviewing' when 'refund_approve' then 'approved' else 'rejected' end;
    if state='approved' and (o.payment_status not in ('approved','partially_refunded')
      or f.amount_cents > o.amount_cents-o.refunded_cents) then raise exception 'Saldo de estorno indisponível.'; end if;
    update public.finance_refunds set status=state, decision=text_value, decided_by=actor where id=f.id;
    perform public.finance_record(o.id,actor,p_action,jsonb_build_object('refund_id',f.id,'decision',text_value),
      case state when 'approved' then 'Reembolso aprovado para processamento.' when 'rejected' then 'Solicitação de reembolso recusada.' end);
  elsif p_action = 'dispute_open' then
    if actor <> o.buyer_id or o.paid_at is null or text_value is null then raise exception 'Contestação indisponível.'; end if;
    insert into public.finance_disputes(order_id,opened_by,description) values(o.id,actor,text_value);
    update public.finance_orders set order_status='disputed' where id=o.id;
    perform public.finance_record(o.id,actor,'dispute_opened','{}','Contestação aberta.');
  elsif p_action = 'dispute_close' then
    if not admin or text_value is null or length(text_value) > 2000 then raise exception 'Indique uma justificativa administrativa.'; end if;
    update public.finance_disputes set status='closed',resolution=text_value
      where order_id=o.id and gateway_dispute is null and status='open' returning * into d;
    if not found then raise exception 'Contestação comercial indisponível.'; end if;
    state := p_data->>'restore';
    if state is null or state not in ('paid','preparing','shipped','delivered','cancelled')
      or ((state = 'delivered') <> (o.received_at is not null) and state <> 'cancelled')
      or (state in ('preparing','shipped') and not exists (
        select 1 from public.finance_events where order_id=o.id and kind=state
      ))
      then raise exception 'Escolha um estado compatível com a entrega.'; end if;
    if not exists(select 1 from public.finance_disputes where order_id=o.id and status='open') then
      update public.finance_orders set order_status=state where id=o.id;
    end if;
    perform public.finance_record(o.id,actor,'dispute_closed',jsonb_build_object('resolution',text_value,'order_status',state),'Contestação comercial analisada.');
  else raise exception 'Ação financeira inválida.';
  end if;
  return jsonb_build_object('order_id',o.id);
end;
$$;

revoke all on function public.finance_admin(), public.finance_can_read(uuid) from public, anon;
grant execute on function public.finance_admin(), public.finance_can_read(uuid) to authenticated;
revoke all on function public.finance_evidence_path(text,uuid,uuid),
  public.finance_offer(uuid,uuid), public.finance_record(uuid,uuid,text,jsonb,text) from public,anon,authenticated;
revoke all on function public.finance_command(text,jsonb) from public,anon;
grant execute on function public.finance_command(text,jsonb) to authenticated;

commit;
