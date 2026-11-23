begin;
alter table public.finance_orders add column gateway_methods text[];
alter table public.finance_orders add column gateway_selected_methods text[];
alter table public.finance_orders add column reconciled_at timestamptz;

create function public.finance_gateway_prepare(p_actor uuid,p_action text,p_data jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  c public.companies%rowtype;
  o public.finance_orders%rowtype;
  f public.finance_refunds%rowtype;
  s public.finance_settings%rowtype;
  seller public.finance_sellers%rowtype;
  selected_methods text[];
  live_mode boolean := (p_data->>'live')::boolean;
begin
  select * into c from public.companies where id=p_actor and active;
  if not found or live_mode is null then raise exception 'Empresa indisponível.' using errcode='42501'; end if;
  if p_action='verify_admin' then
    if c.role <> 'admin' then raise exception 'Acesso administrativo necessário.' using errcode='42501'; end if;
    return '{}';
  end if;
  if p_action='link_seller' then
    if c.role <> 'admin' then raise exception 'Acesso administrativo necessário.' using errcode='42501'; end if;
    insert into public.finance_sellers(company_id,livemode,account_id)
    select id,live_mode,p_data->>'account_id' from public.companies
      where id=(p_data->>'company_id')::uuid and active
    on conflict (company_id,livemode) do update set account_id=excluded.account_id
      where public.finance_sellers.account_id=excluded.account_id
    returning * into seller;
    if not found then raise exception 'Empresa indisponível ou já vinculada a outra conta.'; end if;
    perform public.finance_record(null,p_actor,'seller_linked',jsonb_build_object('company_id',seller.company_id,'live',live_mode));
    return to_jsonb(seller);
  end if;

  select * into o from public.finance_orders where id=(p_data->>'order_id')::uuid for update;
  if not found then raise exception 'Pedido indisponível.'; end if;
  if p_action='reconcile' then
    if p_actor not in (o.buyer_id,o.seller_id) and c.role <> 'admin'
      then raise exception 'Operação sem permissão.' using errcode='42501'; end if;
    if o.gateway_live is distinct from live_mode then raise exception 'Ambiente do pedido incompatível.'; end if;
    if o.reconciled_at > clock_timestamp() - interval '15 seconds'
      then raise exception 'Aguarde alguns segundos antes de consultar novamente.'; end if;
    update public.finance_orders set reconciled_at=clock_timestamp() where id=o.id;
    return to_jsonb(o);
  elsif p_action in ('checkout','checkout_methods') then
    if p_actor <> o.buyer_id then raise exception 'Somente o comprador abre o pagamento.' using errcode='42501'; end if;
    select * into s from public.finance_settings where singleton for share;
    if not s.enabled or s.commission_bps is null then raise exception 'Pagamentos desabilitados.'; end if;
    if o.order_status <> 'awaiting_payment' or o.payment_status not in ('pending','declined') then
      raise exception 'Pagamento já iniciado ou encerrado.';
    end if;
    if not exists(select 1 from public.companies where id=o.seller_id and active) then raise exception 'Vendedor indisponível.'; end if;
    select * into seller from public.finance_sellers where company_id=o.seller_id and livemode=live_mode;
    if not found then raise exception 'O vendedor ainda não tem conta de recebimento configurada.'; end if;
    if o.gateway_live is not null and o.gateway_live <> live_mode then raise exception 'Ambiente do pedido incompatível.'; end if;
    if o.gateway_account is not null and o.gateway_account <> seller.account_id then raise exception 'Conta de recebimento mudou. Solicite reconciliação.'; end if;
    if o.gateway_session is null and o.checkout_started_at < clock_timestamp() - interval '23 hours' then
      raise exception 'A tentativa anterior exige reconciliação antes de continuar.';
    end if;
    if o.checkout_started_at is null then
      update public.finance_orders set gateway_account=seller.account_id,gateway_live=live_mode,
        gateway_methods=s.methods,checkout_started_at=clock_timestamp() where id=o.id returning * into o;
      perform public.finance_record(o.id,p_actor,'checkout_started','{}','Pagamento pendente.');
    end if;
    if p_action='checkout_methods' and o.gateway_selected_methods is null then
      select array_agg(method order by method) into selected_methods
        from (select distinct jsonb_array_elements_text(p_data->'methods') as method) selections
        where method = any(o.gateway_methods);
      if coalesce(cardinality(selected_methods),0)=0 then raise exception 'Nenhum método disponível.'; end if;
      update public.finance_orders set gateway_selected_methods=selected_methods
        where id=o.id returning * into o;
    end if;
    return to_jsonb(o);
  elsif p_action='refund' then
    if c.role <> 'admin' then raise exception 'Acesso administrativo necessário.' using errcode='42501'; end if;
    select * into f from public.finance_refunds where order_id=o.id and id=(p_data->>'refund_id')::uuid for update;
    if not found or f.status not in ('approved','processing') or o.gateway_live is distinct from live_mode
      or o.gateway_payment is null or o.gateway_account is null
      or (f.gateway_refund is null and (o.payment_status not in ('approved','partially_refunded') or f.amount_cents > o.amount_cents-o.refunded_cents))
      then raise exception 'Reembolso indisponível para processamento.'; end if;
    if f.gateway_refund is null and f.gateway_started_at < clock_timestamp() - interval '23 hours' then
      raise exception 'A tentativa de estorno exige reconciliação.';
    end if;
    if f.status='approved' then
      update public.finance_refunds set status='processing',gateway_started_at=clock_timestamp() where id=f.id returning * into f;
      perform public.finance_record(o.id,p_actor,'refund_processing',jsonb_build_object('refund_id',f.id));
    end if;
    return jsonb_build_object('order',to_jsonb(o),'refund',to_jsonb(f));
  end if;
  raise exception 'Operação inválida.';
end;
$$;

create function public.finance_gateway_apply(p_kind text,p_data jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  o public.finance_orders%rowtype;
  f public.finance_refunds%rowtype;
  seller uuid;
  reference text := p_data->>'event_key';
  status_value text := p_data->>'status';
  gateway_id text := p_data->>'payment_id';
  live_mode boolean := (p_data->>'live')::boolean;
  returned integer := (p_data->>'refunded_cents')::integer;
  previous_payment text;
  previous_refund text;
  error_title text;
begin
  if reference is null or live_mode is null or p_data->>'account' is null then raise exception 'Evento financeiro incompleto.'; end if;
  if p_kind='payout' then
    select company_id into seller from public.finance_sellers
      where account_id=p_data->>'account' and livemode=live_mode;
    if not found then return; end if;
    if p_data->>'currency' <> 'brl' then return; end if;
    insert into public.finance_events(kind,provider_key,details)
    values('payout',reference,jsonb_build_object('seller_id',seller,'payout',p_data->>'payout_id','status',status_value))
    on conflict(provider_key) do nothing;
    if not found then return; end if;
    insert into public.finance_payouts(gateway_payout,seller_id,gateway_live,amount_cents,status,arrival_at,observed_at)
    values(p_data->>'payout_id',seller,live_mode,(p_data->>'amount_cents')::integer,status_value,
      to_timestamp((p_data->>'arrival_at')::bigint),(p_data->>'observed_at')::bigint)
    on conflict(gateway_payout,gateway_live) do update set status=excluded.status,arrival_at=excluded.arrival_at,
      observed_at=excluded.observed_at
      where excluded.observed_at>=public.finance_payouts.observed_at
        and (public.finance_payouts.status not in ('paid','failed','canceled') or excluded.status in ('paid','failed','canceled'));
    return;
  end if;

  select * into o from public.finance_orders where id=(p_data->>'order_id')::uuid for update;
  if not found then return; end if;
  if o.gateway_account is distinct from p_data->>'account' or o.gateway_live is distinct from live_mode
    or (gateway_id is not null and o.gateway_payment is not null and o.gateway_payment <> gateway_id)
    then raise exception 'Evento incompatível com o pedido.'; end if;

  if p_kind in ('session','payment') and ((p_data->>'amount_cents')::integer is distinct from o.amount_cents
    or p_data->>'currency' is distinct from 'brl') then raise exception 'Valor ou moeda divergente.'; end if;
  if p_kind='session' and o.gateway_session is not null and o.gateway_session is distinct from p_data->>'session_id'
    then raise exception 'Sessão de cobrança divergente.'; end if;
  if p_kind='session' and (
    p_data->>'session_id' is null or (o.gateway_session is null and (p_data->>'trusted_creation')::boolean is distinct from true)
  ) then raise exception 'Aguardando o vínculo do checkout criado pelo servidor.'; end if;
  if p_kind='payment' and (o.gateway_payment is null or o.gateway_session is null) then
    raise exception 'Aguardando confirmação do pagamento na sessão vinculada.';
  end if;

  insert into public.finance_events(order_id,kind,provider_key,details)
  values(o.id,'stripe_'||p_kind,reference,jsonb_build_object('status',status_value))
  on conflict(provider_key) do nothing;
  if not found then return; end if;
  if p_kind='session' then
    update public.finance_orders set gateway_session=p_data->>'session_id',
      gateway_payment=coalesce(gateway_payment,gateway_id)
    where id=o.id;
    if status_value='expired' and o.paid_at is null and o.payment_status in ('pending','declined') then
      update public.finance_orders set payment_status='expired',order_status='cancelled' where id=o.id;
      perform public.finance_record(o.id,null,'payment_expired','{}','O pagamento expirou.');
    end if;
  elsif p_kind='payment' then
    if gateway_id is null or status_value not in ('pending','processing','declined','approved','cancelled') then
      raise exception 'Estado do pagamento inválido.';
    end if;
    previous_payment := o.payment_status;
    if status_value='approved' then
      if p_data->>'method' is null or (p_data->>'commission_cents')::integer is distinct from o.commission_cents
        then raise exception 'Método ou comissão do pagamento divergente.'; end if;
      returned := greatest(o.refunded_cents,coalesce(returned,0));
      status_value := case when o.payment_status='disputed' then 'disputed'
        when returned=o.amount_cents then 'refunded'
        when returned>0 then 'partially_refunded' else 'approved' end;
      update public.finance_orders set gateway_payment=gateway_id, payment_status=status_value,
        order_status=case when returned=amount_cents and order_status in ('awaiting_payment','paid','preparing','shipped') then 'cancelled'
          when order_status in ('awaiting_payment','cancelled') and o.paid_at is null and returned<amount_cents then 'paid'
          else order_status end,
        paid_at=coalesce(paid_at,clock_timestamp()),refunded_cents=returned,
        payment_method=p_data->>'method',
        gateway_fee_cents=coalesce((p_data->>'fee_cents')::integer,gateway_fee_cents),
        gateway_fee_id=coalesce(p_data->>'fee_id',gateway_fee_id),
        commission_reversed_cents=greatest(commission_reversed_cents,(p_data->>'reversed_cents')::integer)
      where id=o.id;
    elsif o.paid_at is null and o.payment_status not in ('expired','cancelled')
      and not (o.payment_status='processing' and status_value='pending') then
      update public.finance_orders set gateway_payment=gateway_id,payment_status=status_value,
        order_status=case when status_value='cancelled' then 'cancelled' else order_status end where id=o.id;
    else return;
    end if;
    if status_value is distinct from previous_payment then
      error_title := case status_value
        when 'approved' then 'Pagamento confirmado pelo gateway.'
        when 'declined' then 'Pagamento recusado pelo gateway.'
        when 'processing' then 'Pagamento em processamento.'
        when 'refunded' then 'Pagamento totalmente reembolsado.'
        when 'partially_refunded' then 'Pagamento parcialmente reembolsado.'
        when 'cancelled' then 'Pagamento cancelado.' end;
      perform public.finance_record(o.id,null,'payment_'||status_value,'{}',error_title);
    end if;
  elsif p_kind='refund' then
    select * into f from public.finance_refunds where id=(p_data->>'refund_id')::uuid and order_id=o.id for update;
    if not found then return; end if;
    if f.status not in ('processing','succeeded','failed','cancelled') or gateway_id is distinct from o.gateway_payment
      or (p_data->>'amount_cents')::integer is distinct from f.amount_cents
      or p_data->>'currency' is distinct from 'brl'
      or (f.gateway_refund is not null and f.gateway_refund is distinct from p_data->>'provider_refund')
      then raise exception 'Estorno incompatível com a solicitação.'; end if;
    if f.status in ('succeeded','failed','cancelled') then return; end if;
    previous_refund := f.status;
    status_value := case status_value when 'succeeded' then 'succeeded' when 'failed' then 'failed'
      when 'canceled' then 'cancelled' else 'processing' end;
    update public.finance_refunds set status=status_value,gateway_refund=p_data->>'provider_refund' where id=f.id;
    if status_value <> previous_refund then
      perform public.finance_record(o.id,null,'refund_'||status_value,jsonb_build_object('refund_id',f.id),
        case status_value when 'succeeded' then 'Estorno confirmado pelo gateway.'
          when 'failed' then 'O gateway informou falha no estorno.' when 'cancelled' then 'Estorno cancelado pelo gateway.' end);
    end if;
  elsif p_kind='dispute' then
    if gateway_id is null or gateway_id is distinct from o.gateway_payment then raise exception 'Pagamento da contestação diverge.'; end if;
    insert into public.finance_disputes(order_id,gateway_dispute,description,status)
    values(o.id,p_data->>'dispute_id','Contestação registrada pelo gateway.',status_value)
    on conflict(gateway_dispute) do update set status=excluded.status
      where public.finance_disputes.status='open' and excluded.status<>'open';
    if not found then return; end if;
    if status_value='open' then
      update public.finance_orders set order_status='disputed',payment_status='disputed' where id=o.id;
    elsif not exists(select 1 from public.finance_disputes where order_id=o.id and gateway_dispute is not null and status='open') then
      update public.finance_orders set
        payment_status=case when status_value='lost' then 'disputed' when refunded_cents=amount_cents then 'refunded'
          when refunded_cents>0 then 'partially_refunded' else 'approved' end,
        order_status=case
          when exists(select 1 from public.finance_disputes where order_id=o.id and status='open') then 'disputed'
          when status_value='lost' then 'disputed'
          when received_at is not null then 'delivered'
          when exists(select 1 from public.finance_events where order_id=o.id and kind='shipped') then 'shipped'
          when exists(select 1 from public.finance_events where order_id=o.id and kind='preparing') then 'preparing'
          else 'paid' end
      where id=o.id;
    end if;
    perform public.finance_record(o.id,null,'dispute_'||status_value,'{}',
      case when status_value='open' then 'Contestação aberta no gateway.' else 'Contestação atualizada pelo gateway.' end);
  else raise exception 'Tipo de evento inválido.';
  end if;
end;
$$;

create function public.finance_due_refunds()
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  o public.finance_orders%rowtype;
  notified integer := 0;
begin
  for o in select * from public.finance_orders
    where order_status='delivered' and payment_status in ('approved','partially_refunded')
      and refund_deadline_at between clock_timestamp() and clock_timestamp()+interval '24 hours'
      and not exists(select 1 from public.finance_refunds f where f.order_id=finance_orders.id and f.status in ('requested','reviewing','approved','processing'))
      and not exists(select 1 from public.finance_events e where e.provider_key='refund-reminder:'||finance_orders.id)
    order by refund_deadline_at limit 200 for update skip locked
  loop
    insert into public.finance_events(order_id,kind,provider_key)
    values(o.id,'refund_deadline_near','refund-reminder:'||o.id) on conflict(provider_key) do nothing;
    if found then
      insert into public.notifications(user_id,type,title,link)
      values(o.buyer_id,'sistema','O prazo comercial de reembolso termina em até 24 horas.','/financeiro?pedido='||o.id);
      notified := notified+1;
    end if;
  end loop;
  return notified;
end;
$$;

revoke all on function public.finance_gateway_prepare(uuid,text,jsonb),
  public.finance_gateway_apply(text,jsonb), public.finance_due_refunds() from public,anon,authenticated;
grant execute on function public.finance_gateway_prepare(uuid,text,jsonb),
  public.finance_gateway_apply(text,jsonb), public.finance_due_refunds() to service_role;

commit;
