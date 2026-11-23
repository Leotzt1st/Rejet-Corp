-- =====================================================================
--  REJET CORP — migration: increment_views (RPC seguro)
--  Executar no SQL Editor do Supabase (em ordem).
-- =====================================================================

-- Coluna para controle anti-abuso do contador de visualizações
alter table public.produtos
  add column if not exists views_updated_at timestamptz;

-- RPC: incrementa visualizações, no máximo 1x por produto a cada 30s
create or replace function public.increment_views(row_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if row_id is null then
    return;
  end if;

  update public.produtos
     set views = views + 1,
         views_updated_at = now()
   where id = row_id
     and (
       views_updated_at is null
       or views_updated_at < now() - interval '30 seconds'
     );
end;
$$;

revoke all on function public.increment_views(uuid) from public;
grant execute on function public.increment_views(uuid) to authenticated;
