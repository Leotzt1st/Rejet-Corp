begin;

create function public.recheck_company_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.cnpj is distinct from old.cnpj
    or new.company_name is distinct from old.company_name
    or new.trade_name is distinct from old.trade_name then
    new.verified := false;
  end if;

  return new;
end;
$$;

-- Runs after protect_company_admin_fields, which preserves the previous badge on self-edits.
create trigger recheck_company_identity
before update of cnpj, company_name, trade_name on public.companies
for each row execute function public.recheck_company_identity();

create function public.reserve_negotiation_lot()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Only the competing update that still sees an active lot can reserve it.
  update public.produtos p
     set status = 'sold', updated_at = pg_catalog.now()
   where p.id = old.product_id
     and p.created_by = old.seller_id
     and p.status = 'active'
     and not exists (
       select 1 from public.negotiations n
        where n.product_id = p.id and n.status in ('aceito', 'finalizado')
     );

  if not found then
    raise exception 'Este lote já foi reservado ou não está disponível.' using errcode = '23514';
  end if;

  return new;
end;
$$;

-- The existing guard runs first and checks the seller and the allowed transition.
create trigger reserve_negotiation_lot
before update of status on public.negotiations
for each row when (new.status = 'aceito' and old.status is distinct from new.status)
execute function public.reserve_negotiation_lot();

create function public.guard_reserved_lot()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.negotiations n
     where n.product_id = old.id and n.status in ('aceito', 'finalizado')
  ) then
    raise exception 'Este lote já foi reservado. Cadastre um novo anúncio para outro lote.' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger guard_reserved_lot
before update of status on public.produtos
for each row when (new.status = 'active' and old.status is distinct from new.status)
execute function public.guard_reserved_lot();

-- Reconcile older offers whose separate client-side reservation did not run.
update public.produtos p set status = 'sold', updated_at = pg_catalog.now()
where p.status = 'active' and exists (
  select 1 from public.negotiations n
   where n.product_id = p.id and n.status in ('aceito', 'finalizado')
);

commit;
