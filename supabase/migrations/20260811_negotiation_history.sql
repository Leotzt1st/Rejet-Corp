-- =====================================================================
--  REJET CORP — migration: histórico de negociações
-- =====================================================================

create table if not exists public.negotiation_history (
  id            uuid primary key default gen_random_uuid(),
  negotiation_id uuid not null references public.negotiations(id) on delete cascade,
  status_from   text,
  status_to     text not null,
  note          text,
  created_by    uuid references public.companies(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists negotiation_history_negotiation_idx
  on public.negotiation_history(negotiation_id, created_at);

alter table public.negotiation_history enable row level security;

-- Participantes podem ler o histórico da negociação
drop policy if exists "negotiation_history_select_participant" on public.negotiation_history;
create policy "negotiation_history_select_participant"
  on public.negotiation_history for select
  using (
    exists (
      select 1 from public.negotiations n
      where n.id = negotiation_history.negotiation_id
        and (n.buyer_id = auth.uid() or n.seller_id = auth.uid())
    )
  );

-- Trigger que grava o histórico a cada criação/alteração de status
create or replace function public.record_negotiation_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.negotiation_history (negotiation_id, status_from, status_to, note, created_by)
  values (new.id, coalesce(old.status, null), new.status, null, coalesce(auth.uid(), new.buyer_id));
  return new;
end;
$$;

drop trigger if exists trg_negotiation_history on public.negotiations;
create trigger trg_negotiation_history
  after insert or update of status on public.negotiations
  for each row execute function public.record_negotiation_history();
