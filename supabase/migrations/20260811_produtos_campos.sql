-- =====================================================================
--  REJET CORP — migration: campos novos de produto
-- =====================================================================

alter table public.produtos
  add column if not exists negotiable  boolean not null default false,
  add column if not exists min_quantity numeric;
