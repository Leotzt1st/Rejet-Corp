begin;

alter table public.negotiations
  add column confirmed_payment_method text
  check (confirmed_payment_method in ('pix', 'card', 'boleto')),
  add column payment_required boolean not null default true;

-- Preserve the free-material path for accepted negotiations created before this migration.
update public.negotiations n set payment_required = false
from public.produtos p
where n.product_id = p.id and n.status = 'aceito' and p.is_free
  and coalesce(n.offered_price, 0) = 0;

create function public.guard_negotiation_payment_confirmation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.confirmed_payment_method is not null then
      raise exception 'Confirme a forma de pagamento após o aceite.' using errcode = '42501';
    end if;
    new.payment_required := true;
    if new.status = 'aceito' then
      new.payment_required := coalesce(new.offered_price, 0) <> 0 or not exists (
        select 1 from public.produtos p where p.id = new.product_id and p.is_free
      );
    end if;
    return new;
  end if;

  new.payment_required := old.payment_required;
  if new.status = 'aceito' and old.status is distinct from new.status then
    new.payment_required := coalesce(old.offered_price, 0) <> 0 or not exists (
      select 1 from public.produtos p where p.id = old.product_id and p.is_free
    );
  end if;

  if new.confirmed_payment_method is distinct from old.confirmed_payment_method then
    if auth.uid() is distinct from old.buyer_id
      or old.status <> 'aceito'
      or not old.payment_required
      or new.status is distinct from old.status
      or old.confirmed_payment_method is not null then
      raise exception 'Somente o comprador pode confirmar a forma de pagamento após o aceite.' using errcode = '42501';
    end if;
  end if;

  if new.status = 'finalizado' and old.status is distinct from new.status
    and old.payment_required and old.confirmed_payment_method is null then
    raise exception 'Aguarde o comprador confirmar a forma de pagamento.' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger guard_negotiation_payment_confirmation
before insert or update of status, confirmed_payment_method, payment_required on public.negotiations
for each row execute function public.guard_negotiation_payment_confirmation();

commit;
