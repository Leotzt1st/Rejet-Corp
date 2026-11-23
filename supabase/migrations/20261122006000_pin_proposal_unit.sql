begin;

alter table public.negotiations add column proposed_unit text;

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

    new.accepted_quantity := null;
    new.accepted_unit_price := null;
    new.accepted_unit := null;
  else
    new.proposed_unit := old.proposed_unit;
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
  if new.accepted_quantity is not null and (
    new.accepted_quantity <= 0 or new.accepted_quantity::text in ('NaN', 'Infinity', '-Infinity')
    or (lot.quantities is not null and new.accepted_quantity > lot.quantities)
  ) then
    raise exception 'A quantidade proposta não está disponível neste lote.' using errcode = '23514';
  end if;

  return new;
end;
$$;

commit;
