create or replace function public.protect_company_admin_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role = 'company' and new.verified = false and new.active = true then
      return new;
    end if;
  elsif new.role is not distinct from old.role
    and new.verified is not distinct from old.verified
    and new.active is not distinct from old.active then
    return new;
  end if;

  if exists (
    select 1 from public.companies
    where id = auth.uid() and role = 'admin' and active
  ) then
    return new;
  end if;

  raise exception 'Somente administradores ativos podem alterar os campos administrativos da empresa.'
    using errcode = '42501';
end;
$$;

drop trigger if exists protect_company_admin_fields on public.companies;
create trigger protect_company_admin_fields
before insert or update on public.companies
for each row execute function public.protect_company_admin_fields();
