begin;

update storage.buckets set public=false, file_size_limit=5000000,
  allowed_mime_types=array['image/jpeg','image/png','image/webp','application/pdf']
where id='produtos';

update storage.buckets set public=false where id='finance-evidence';

drop policy finance_evidence_read on storage.objects;
create policy finance_evidence_read on storage.objects for select to authenticated
  using (bucket_id='finance-evidence');

create policy finance_evidence_scoped_read on storage.objects as restrictive for select to authenticated using (
  bucket_id <> 'finance-evidence' or (
    public.is_current_company_active() and exists (
      select 1 from public.finance_orders o
        where o.id::text=(storage.foldername(storage.objects.name))[1]
          and (
            public.finance_admin() or (storage.foldername(storage.objects.name))[2]=auth.uid()::text
            or o.shipment_evidence=storage.objects.name or exists (
              select 1 from public.finance_refunds r where r.order_id=o.id and r.evidence_path=storage.objects.name
            )
          )
    )
  )
);

create policy finance_evidence_require_auth on storage.objects as restrictive for all to anon
  using (bucket_id <> 'finance-evidence') with check (bucket_id <> 'finance-evidence');

drop policy finance_evidence_insert on storage.objects;
create policy finance_evidence_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'finance-evidence'
);

create policy finance_evidence_scoped_insert on storage.objects as restrictive for insert to authenticated with check (
  bucket_id <> 'finance-evidence' or (
    cardinality(storage.foldername(name))=2 and (storage.foldername(name))[2]=auth.uid()::text
    and public.is_current_company_active() and exists (
      select 1 from public.finance_orders o where o.id::text=(storage.foldername(storage.objects.name))[1]
        and (auth.uid() in (o.buyer_id,o.seller_id) or public.finance_admin())
    )
  )
);

create policy finance_evidence_no_updates on storage.objects as restrictive for update to authenticated
  using (bucket_id <> 'finance-evidence') with check (bucket_id <> 'finance-evidence');

create policy finance_evidence_no_deletes on storage.objects as restrictive for delete to authenticated
  using (bucket_id <> 'finance-evidence');

commit;
