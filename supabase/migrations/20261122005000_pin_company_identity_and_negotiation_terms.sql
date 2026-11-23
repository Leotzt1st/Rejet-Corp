begin;

alter table public.companies
  add column identity_revision uuid not null default pg_catalog.gen_random_uuid();

create or replace function public.recheck_company_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.identity_revision := pg_catalog.gen_random_uuid();
    return new;
  end if;

  if current_user in ('authenticated', 'anon') and new.verified is distinct from old.verified then
    raise exception 'Atualize a verificação pelo painel administrativo.' using errcode = '42501';
  end if;

  new.identity_revision := old.identity_revision;
  if new.cnpj is distinct from old.cnpj
    or new.company_name is distinct from old.company_name
    or new.trade_name is distinct from old.trade_name then
    new.identity_revision := pg_catalog.gen_random_uuid();
    new.verified := false;
  end if;

  return new;
end;
$$;

drop trigger recheck_company_identity on public.companies;
create trigger recheck_company_identity
before insert or update on public.companies
for each row execute function public.recheck_company_identity();

create function public.admin_set_company_verification(p_company_id uuid, p_identity_revision uuid, p_verified boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.companies c where c.id = auth.uid() and c.role = 'admin' and c.active
  ) then
    raise exception 'Acesso administrativo necessário.' using errcode = '42501';
  end if;

  update public.companies c set verified = p_verified, updated_at = pg_catalog.now()
   where c.id = p_company_id and c.identity_revision = p_identity_revision;
  if not found then
    raise exception 'O cadastro mudou. Confira os dados atualizados antes de confirmar.';
  end if;
end;
$$;

revoke all on function public.admin_set_company_verification(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.admin_set_company_verification(uuid, uuid, boolean) to authenticated;

alter table public.negotiations
  add column accepted_quantity numeric,
  add column accepted_unit_price numeric,
  add column accepted_unit text,
  add column accepted_total_cents numeric generated always as (round(accepted_quantity * accepted_unit_price * 100)) stored;

-- Best available baseline for old agreements. Explicit offer values take precedence.
update public.negotiations n
   set accepted_quantity = case when p.quantities is null or coalesce(n.quantity, p.quantities) <= p.quantities
                           then coalesce(n.quantity, p.quantities) end,
       accepted_unit_price = case when not n.payment_required then 0 else coalesce(n.offered_price, p.price) end,
       accepted_unit = p.unit
  from public.produtos p
 where p.id = n.product_id and n.status in ('aceito', 'finalizado');

-- An existing order is the authoritative record for its price and units.
update public.negotiations n
   set accepted_quantity = o.quantity,
       accepted_unit_price = (o.amount_cents::numeric / 100) / o.quantity,
       accepted_unit = o.unit
  from public.finance_orders o
 where o.negotiation_id = n.id and n.status in ('aceito', 'finalizado');

create function public.guard_accepted_negotiation_terms()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.accepted_quantity := null;
    new.accepted_unit_price := null;
    new.accepted_unit := null;
  else
    new.accepted_quantity := old.accepted_quantity;
    new.accepted_unit_price := old.accepted_unit_price;
    new.accepted_unit := old.accepted_unit;
  end if;
  return new;
end;
$$;

-- Runs before reserve_negotiation_lot, the only trigger that sets accepted terms.
create trigger guard_accepted_negotiation_terms
before insert or update on public.negotiations
for each row execute function public.guard_accepted_negotiation_terms();

create or replace function public.reserve_negotiation_lot()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  lot public.produtos%rowtype;
begin
  update public.produtos p
     set status = 'sold', updated_at = pg_catalog.now()
   where p.id = old.product_id
     and p.created_by = old.seller_id
     and p.status = 'active'
     and not exists (
       select 1 from public.negotiations n
        where n.product_id = p.id and n.status in ('aceito', 'finalizado')
     )
  returning p.* into lot;

  if not found then
    raise exception 'Este lote já foi reservado ou não está disponível.' using errcode = '23514';
  end if;

  new.payment_required := not lot.is_free or coalesce(old.offered_price, 0) <> 0;
  new.accepted_quantity := coalesce(old.quantity, lot.quantities);
  new.accepted_unit_price := case when not new.payment_required then 0 else coalesce(old.offered_price, lot.price) end;
  new.accepted_unit := lot.unit;
  if new.accepted_quantity is not null and (
    new.accepted_quantity <= 0 or new.accepted_quantity::text in ('NaN', 'Infinity', '-Infinity')
    or (lot.quantities is not null and new.accepted_quantity > lot.quantities)
  ) then
    raise exception 'A quantidade proposta não está disponível neste lote.' using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.finance_offer(p_negotiation uuid, p_buyer uuid)
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
  qty := n.accepted_quantity;
  total := n.accepted_total_cents;
  if qty is null or qty <= 0 or qty::text in ('NaN','Infinity','-Infinity')
    or total is null or total not between 1 and 99999999 or not n.payment_required or n.accepted_unit is null
  then raise exception 'Revise o preço e a quantidade negociados.'; end if;
  return jsonb_build_object(
    'product_id',p.id,'seller_id',n.seller_id,'material',p.product,'unit',n.accepted_unit,'quantity',qty,
    'amount_cents',total::integer,'commission_bps',s.commission_bps,
    'commission_cents',round(total * s.commission_bps / 10000)::integer,'reverse_commission',s.reverse_commission
  );
end;
$$;

commit;
