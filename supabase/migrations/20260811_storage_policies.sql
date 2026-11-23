-- =====================================================================
--  REJET CORP — migration: Storage (bucket + policies)
--  Executar no SQL Editor do Supabase (como postgres/supabase_admin).
-- =====================================================================

-- 1) Cria o bucket "produtos" (se ainda não existir)
insert into storage.buckets (id, name, public)
values ('produtos', 'produtos', true)
on conflict (id) do nothing;

-- 2) Policies de objetos do bucket "produtos"
--    Upload apenas para usuários autenticados e donos do arquivo.
drop policy if exists "produtos_storage_insert_owner" on storage.objects;
create policy "produtos_storage_insert_owner"
  on storage.objects for insert
  with check (
    bucket_id = 'produtos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

--    Leitura pública (bucket público)
drop policy if exists "produtos_storage_select_public" on storage.objects;
create policy "produtos_storage_select_public"
  on storage.objects for select
  using (bucket_id = 'produtos');

--    Atualização apenas do dono
drop policy if exists "produtos_storage_update_owner" on storage.objects;
create policy "produtos_storage_update_owner"
  on storage.objects for update
  using (
    bucket_id = 'produtos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

--    Exclusão apenas do dono
drop policy if exists "produtos_storage_delete_owner" on storage.objects;
create policy "produtos_storage_delete_owner"
  on storage.objects for delete
  using (
    bucket_id = 'produtos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
