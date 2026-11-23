begin;
create function public.finance_summary(p_view text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_current_company_active() or p_view is null or p_view not in ('buyer','seller','admin')
    or (p_view='admin' and not public.finance_admin()) then
    raise exception 'Acesso financeiro indisponível.' using errcode='42501';
  end if;
  with orders as (
    select * from public.finance_orders o where o.gateway_live is true
      and (p_view='admin' or (p_view='buyer' and o.buyer_id=auth.uid()) or (p_view='seller' and o.seller_id=auth.uid()))
  )
  select jsonb_build_object(
    'orders',count(*),
    'pending',count(*) filter(where payment_status in ('pending','processing')),
    'paid',count(*) filter(where paid_at is not null),
    'awaiting_delivery',count(*) filter(where order_status in ('paid','preparing','shipped')),
    'delivered',count(*) filter(where order_status='delivered'),
    'gross_cents',coalesce(sum(amount_cents) filter(where paid_at is not null),0),
    'refunded_cents',coalesce(sum(refunded_cents),0),
    'commission_cents',coalesce(sum(commission_cents) filter(where paid_at is not null),0),
    'net_commission_cents',case when count(*) filter(where paid_at is not null and refunded_cents>0 and commission_reversed_cents is null)=0
      then coalesce(sum(commission_cents-coalesce(commission_reversed_cents,0)) filter(where paid_at is not null),0) end,
    'gateway_fees_cents',case when count(*) filter(where paid_at is not null and gateway_fee_cents is null)=0
      then coalesce(sum(gateway_fee_cents) filter(where paid_at is not null),0) end,
    'seller_net_cents',case when count(*) filter(where paid_at is not null and (gateway_fee_cents is null or (refunded_cents>0 and commission_reversed_cents is null)))=0
      then coalesce(sum(amount_cents-commission_cents-gateway_fee_cents-refunded_cents+coalesce(commission_reversed_cents,0)) filter(where paid_at is not null),0) end,
    'refund_requested',(select count(*) from public.finance_refunds f join orders o on o.id=f.order_id),
    'refund_completed',(select count(*) from public.finance_refunds f join orders o on o.id=f.order_id where f.status='succeeded'),
    'disputes',(select count(*) from public.finance_disputes d join orders o on o.id=d.order_id where d.status='open'),
    'payout_paid_cents',(select coalesce(sum(amount_cents),0) from public.finance_payouts p
      where p.gateway_live and p.status='paid' and (p_view='admin' or (p_view='seller' and p.seller_id=auth.uid()))),
    'payout_pending_cents',(select coalesce(sum(amount_cents),0) from public.finance_payouts p
      where p.gateway_live and p.status in ('pending','in_transit') and (p_view='admin' or (p_view='seller' and p.seller_id=auth.uid())))
  ) into result from orders;
  return result;
end;
$$;

revoke all on function public.finance_summary(text) from public,anon;
grant execute on function public.finance_summary(text) to authenticated;

create function public.finance_find_companies(p_query text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  needle text := left(lower(btrim(p_query)),100);
begin
  if not public.finance_admin() then raise exception 'Acesso administrativo necessário.' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(id),'[]') from (
    select c.id from public.companies c
    where needle <> '' and (strpos(lower(c.company_name),needle)>0 or strpos(lower(coalesce(c.trade_name,'')),needle)>0 or c.id::text=needle)
    order by c.company_name,c.id limit 100
  ) companies);
end;
$$;
revoke all on function public.finance_find_companies(text) from public,anon;
grant execute on function public.finance_find_companies(text) to authenticated;
commit;
