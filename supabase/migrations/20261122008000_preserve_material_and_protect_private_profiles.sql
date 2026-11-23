begin;

alter table public.negotiations add column accepted_material jsonb;

update public.negotiations n
set accepted_material = jsonb_build_object(
  'name',coalesce((select o.material from public.finance_orders o where o.negotiation_id=n.id),p.product),
  'description',p.description,'category',p.category,'condition',p.condition,'type',p.material_type
)
from public.produtos p
where n.product_id=p.id and n.status in ('aceito','finalizado');

create or replace function public.guard_accepted_negotiation_terms()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'interesse' and not exists (
      select 1 from public.produtos p
       where p.id = new.product_id and p.unit = new.proposed_unit
    ) then
      raise exception 'A unidade do anúncio mudou ou está indisponível. Atualize o anúncio antes de enviar a proposta.' using errcode = '23514';
    end if;

    new.accepted_material := null;
    new.accepted_quantity := null;
    new.accepted_unit_price := null;
    new.accepted_unit := null;
  else
    new.proposed_unit := old.proposed_unit;
    new.accepted_material := old.accepted_material;
    new.accepted_quantity := old.accepted_quantity;
    new.accepted_unit_price := old.accepted_unit_price;
    new.accepted_unit := old.accepted_unit;
  end if;
  return new;
end;
$$;

create or replace function public.reserve_negotiation_lot()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  lot public.produtos%rowtype;
begin
  if old.proposed_unit is null then
    raise exception 'A proposta não tem unidade registrada. Solicite uma nova proposta ao comprador.' using errcode = '23514';
  end if;

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

  -- Compare with the row locked by the reservation. A mismatch rolls back both changes.
  if old.proposed_unit is distinct from lot.unit then
    raise exception 'A unidade do anúncio mudou. Solicite uma nova proposta ao comprador.' using errcode = '23514';
  end if;

  new.payment_required := not lot.is_free or coalesce(old.offered_price, 0) <> 0;
  new.accepted_quantity := coalesce(old.quantity, lot.quantities);
  new.accepted_unit_price := case when not new.payment_required then 0 else coalesce(old.offered_price, lot.price) end;
  new.accepted_unit := lot.unit;
  new.accepted_material := jsonb_build_object(
    'name',lot.product,'description',lot.description,'category',lot.category,'condition',lot.condition,'type',lot.material_type
  );
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
    or total is null or total not between 1 and 99999999 or not n.payment_required or n.accepted_unit is null or n.accepted_material->>'name' is null
  then raise exception 'Revise o preço e a quantidade negociados.'; end if;
  return jsonb_build_object(
    'product_id',p.id,'seller_id',n.seller_id,'material',n.accepted_material->>'name','unit',n.accepted_unit,'quantity',qty,
    'amount_cents',total::integer,'commission_bps',s.commission_bps,
    'commission_cents',round(total * s.commission_bps / 10000)::integer,'reverse_commission',s.reverse_commission
  );
end;
$$;

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
          public.admin_has_mfa()
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

commit;
