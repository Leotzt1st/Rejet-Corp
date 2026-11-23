begin;

create function public.admin_has_mfa()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce(auth.jwt()->>'aal' = 'aal2', false) and exists (
    select 1 from public.companies c where c.id = auth.uid() and c.role = 'admin' and c.active
  );
$$;
revoke all on function public.admin_has_mfa() from public, anon, authenticated;
grant execute on function public.admin_has_mfa() to authenticated;

create or replace function public.finance_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select public.admin_has_mfa(); $$;

create or replace function public.protect_company_admin_fields()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'INSERT' then
    new.role := 'company';
    new.verified := false;
    new.active := true;
    new.rating := 0;
    new.review_count := 0;
    return new;
  end if;
  if public.admin_has_mfa() then return new; end if;
  new.role := old.role;
  new.verified := old.verified;
  new.active := old.active;
  new.rating := old.rating;
  new.review_count := old.review_count;
  return new;
end;
$$;

create or replace function public.list_companies_for_admin()
returns setof public.companies
language sql stable security definer
set search_path = ''
as $$
  select c.*
    from public.companies c
   where public.admin_has_mfa()
   order by c.created_at desc;
$$;

create or replace function public.admin_archive_product(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_updated integer;
begin
  if not public.admin_has_mfa() then
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

create or replace function public.admin_delete_company(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_deleted integer;
begin
  if not public.admin_has_mfa() then
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

create or replace function public.admin_set_company_verification(p_company_id uuid, p_identity_revision uuid, p_verified boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.admin_has_mfa() then
    raise exception 'Acesso administrativo necessário.' using errcode = '42501';
  end if;

  update public.companies c set verified = p_verified, updated_at = pg_catalog.now()
   where c.id = p_company_id and c.identity_revision = p_identity_revision;
  if not found then
    raise exception 'O cadastro mudou. Confira os dados atualizados antes de confirmar.';
  end if;
end;
$$;

create or replace function public.finance_gateway_prepare(p_actor uuid,p_action text,p_data jsonb)
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
    if c.role <> 'admin' or (p_data->>'admin_aal2') is distinct from 'true' then raise exception 'Acesso administrativo necessário.' using errcode='42501'; end if;
    return '{}';
  end if;
  if p_action='link_seller' then
    if c.role <> 'admin' or (p_data->>'admin_aal2') is distinct from 'true' then raise exception 'Acesso administrativo necessário.' using errcode='42501'; end if;
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
    if p_actor not in (o.buyer_id,o.seller_id) and (c.role <> 'admin' or (p_data->>'admin_aal2') is distinct from 'true')
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
    if c.role <> 'admin' or (p_data->>'admin_aal2') is distinct from 'true' then raise exception 'Acesso administrativo necessário.' using errcode='42501'; end if;
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

drop policy companies_update_admin on public.companies;
create policy companies_update_admin on public.companies for update to authenticated
  using ((select public.admin_has_mfa())) with check ((select public.admin_has_mfa()));

drop policy reports_select_admin on public.reports;
create policy reports_select_admin on public.reports for select to authenticated
  using ((select public.admin_has_mfa()));
drop policy reports_update_admin on public.reports;
create policy reports_update_admin on public.reports for update to authenticated
  using ((select public.admin_has_mfa())) with check ((select public.admin_has_mfa()));

drop policy activity_logs_select_admin on public.activity_logs;
create policy activity_logs_select_admin on public.activity_logs for select to authenticated
  using ((select public.admin_has_mfa()));

do $$
declare
  t text;
begin
  foreach t in array array['categories','subcategories'] loop
    execute format('create policy mfa_for_category_inserts on public.%I as restrictive for insert to authenticated with check ((select public.admin_has_mfa()))', t);
    execute format('create policy mfa_for_category_updates on public.%I as restrictive for update to authenticated using ((select public.admin_has_mfa())) with check ((select public.admin_has_mfa()))', t);
    execute format('create policy mfa_for_category_deletes on public.%I as restrictive for delete to authenticated using ((select public.admin_has_mfa()))', t);
  end loop;
end;
$$;

commit;
