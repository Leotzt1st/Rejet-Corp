import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

const reference = process.env.FINANCE_PGLITE_MODULE;
const { PGlite } = await import(reference ? pathToFileURL(reference).href : "@electric-sql/pglite");
const buyer="10000000-0000-4000-8000-000000000001";
const seller="10000000-0000-4000-8000-000000000002";
const admin="10000000-0000-4000-8000-000000000003";
const outsider="10000000-0000-4000-8000-000000000004";
const product="10000000-0000-4000-8000-000000000005";
const negotiation="10000000-0000-4000-8000-000000000006";
const product2="10000000-0000-4000-8000-000000000007";
const negotiation2="10000000-0000-4000-8000-000000000008";
const account="acct_fixture";

test("finance: orders, permissions, provider events and partial/full refunds in PostgreSQL", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  // Model only the external Supabase primitives used by the application's actual migrations.
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema storage;
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select current_user::text $$;
    create function auth.jwt() returns jsonb language sql stable
      as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid,owner_id text);
    create function storage.foldername(name text) returns text[] language sql immutable
      as $$ select parts[1:cardinality(parts)-1] from (select string_to_array(name,'/') parts) s $$;
    alter table storage.objects enable row level security;
    grant usage on schema auth,storage to anon,authenticated,service_role;
    grant select,insert on storage.objects to authenticated;
  `);
  const base = await readFile(new URL("../supabase/schema.sql",import.meta.url),"utf8");
  await db.exec(base.replace(/^create extension if not exists pgcrypto;$/m,""));
  for (const name of ["core","gateway","summary"]) {
    const suffix = {core:"000000",gateway:"001000",summary:"002000"}[name];
    const sql = await readFile(new URL(`../supabase/migrations/20261122${suffix}_finance_${name}.sql`,import.meta.url),"utf8");
    await db.exec(sql);
  }
  await db.exec(await readFile(new URL("../supabase/migrations/20261122003000_require_negotiation_payment_confirmation.sql",import.meta.url),"utf8"));
  await db.exec("grant select, update on public.negotiations, public.produtos to authenticated");
  await db.exec("grant insert on public.negotiations to authenticated");
  await db.exec("grant update on public.companies to authenticated");
  await db.exec("grant select, insert on public.conversations, public.messages to authenticated");
  await db.exec("grant insert on public.reports to authenticated");

  const q = async (sql,args=[]) => (await db.query(sql,args)).rows;
  const identity = async (id, role="authenticated", aal=id===admin ? "aal2" : "aal1") => {
    await db.exec("reset role");
    await q("select set_config('request.jwt.claim.sub',$1,false)",[id]);
    await q("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,aal})]);
    await db.exec(`set role ${role}`);
  };
  const command = async (action,data) => (await q("select public.finance_command($1,$2::jsonb) result",[action,JSON.stringify(data)]))[0].result;
  const prepare = async (user,action,data) => (await q("select public.finance_gateway_prepare($1,$2,$3::jsonb) result",[user,action,JSON.stringify({admin_aal2:user===admin,...data})]))[0].result;
  const event = (kind,data) => q("select public.finance_gateway_apply($1,$2::jsonb)",[kind,JSON.stringify(data)]);
  const read = async (id) => (await q("select * from public.finance_orders where id=$1",[id]))[0];
  const config = { enabled:true, commission_bps:500, methods:["card","pix"], reverse_commission:true };

  await db.exec(`
    insert into public.companies(id,company_name,role) values
      ('${buyer}','Compradora de teste','company'),('${seller}','Vendedora de teste','company'),
      ('${admin}','Admin de teste','admin'),('${outsider}','Outra empresa','company');
    insert into public.produtos(id,product,created_by,quantities,price) values
      ('${product}','Lote de teste','${seller}',10,2.565),('${product2}','Segundo lote','${seller}',10,10);
    insert into public.negotiations(id,product_id,buyer_id,seller_id,status,quantity) values
      ('${negotiation}','${product}','${buyer}','${seller}','aceito',3),
      ('${negotiation2}','${product2}','${buyer}','${seller}','aceito',1);
  `);
  await db.exec(await readFile(new URL("../supabase/migrations/20261122004000_protect_company_verification_and_lot_reservation.sql",import.meta.url),"utf8"));
  await db.exec(await readFile(new URL("../supabase/migrations/20261122005000_pin_company_identity_and_negotiation_terms.sql",import.meta.url),"utf8"));
  const [{id:freeProduct}] = await q("insert into public.produtos(product,created_by,is_free,quantities) values('Lote gratuito QA',$1,true,5) returning id",[seller]);
  const [{id:legacyProposal}] = await q(`insert into public.negotiations(product_id,buyer_id,seller_id,status)
    values ($1,$2,$3,'interesse') returning id`,[freeProduct,buyer,seller]);
  await db.exec(await readFile(new URL("../supabase/migrations/20261122006000_pin_proposal_unit.sql",import.meta.url),"utf8"));
  for (const migration of [
    "20261122007000_require_mfa_for_administration",
    "20261122008000_preserve_material_and_protect_private_profiles",
    "20261122009000_restrict_storage_and_unattached_evidence",
    "20261122010000_protect_registration_and_limit_abuse",
  ]) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${migration}.sql`, import.meta.url),"utf8"));
  }
  await q("update public.companies set cnpj='QATEST01' where id in ($1,$2)",[seller,outsider]);
  assert.deepEqual(await q("select status from public.produtos where id=$1",[product2]),[{status:"sold"}]);

  await identity(buyer);
  const [{id:conversationId, updated_at:conversationCreated}] = await q(
    "insert into public.conversations(product_id,participant_a,participant_b) values($1,$2,$3) returning id,updated_at",
    [freeProduct,buyer,seller],
  );
  await assert.rejects(q(
    "insert into public.conversations(product_id,participant_a,participant_b) values($1,$2,$3)",
    [freeProduct,buyer,seller],
  ),/Já existe uma conversa/);
  await q("insert into public.messages(conversation_id,sender_id,content) values($1,$2,$3)",[conversationId,buyer,"Mensagem de teste"]);
  const [{updated_at:conversationUpdated}] = await q("select updated_at from public.conversations where id=$1",[conversationId]);
  assert.ok(conversationUpdated >= conversationCreated);
  const report = () => q("insert into public.reports(reporter_id,target_type,target_id,reason) values($1,'product',$2,'Denúncia fictícia')",[buyer,freeProduct]);
  await report();
  await assert.rejects(report(),/denúncia em andamento/);
  await assert.rejects(command("quote",{negotiation_id:negotiation}),/não configurados/);
  await assert.rejects(command("settings",config),/administrativo/);
  await identity(admin,"authenticated","aal1");
  await assert.rejects(command("settings",config),/administrativo/);
  await identity(admin);
  await assert.rejects(command("settings",{ ...config, commission_bps:null }),/Defina a comissão/);
  await command("settings",config);
  await identity(seller);
  await q("update public.produtos set product='Nome atualizado do anúncio', price=80, unit='t', quantities=2 where id=$1",[product]);
  await q("update public.negotiations set accepted_quantity=2, accepted_unit_price=80, accepted_unit='t' where id=$1",[negotiation]);
  await identity(buyer);
  const quote = await command("quote",{negotiation_id:negotiation});
  assert.equal(quote.amount_cents,770);
  assert.equal(quote.commission_cents,39);
  assert.equal(quote.quantity,3);
  assert.equal(quote.unit,"kg");
  await assert.rejects(command("open",{negotiation_id:negotiation,amount_cents:1,commission_bps:500}),/mudou/);
  const input = {negotiation_id:negotiation,amount_cents:770,commission_bps:500};
  const [first, repeat] = await Promise.all([command("open",input),command("open",input)]);
  assert.equal(first.order_id,repeat.order_id);
  const id=first.order_id;
  assert.equal((await read(id)).material,"Lote de teste");
  await assert.rejects(q("update public.finance_orders set amount_cents=1 where id=$1",[id]),/permission denied/);
  await assert.rejects(event("payment",{order_id:id}),/permission denied/);
  await identity(outsider);
  assert.equal(await read(id),undefined);
  await assert.rejects(command("receive",{order_id:id}),/indisponível/);
  await identity(admin);
  const adminEvidence = `${id}/${admin}/excecao-qa.pdf`;
  const uploadAdminEvidence = () => q("insert into storage.objects(bucket_id,name,owner_id) values ('finance-evidence',$1,$2)",[adminEvidence,admin]);
  await identity(admin,"authenticated","aal1");
  await assert.rejects(uploadAdminEvidence(),/row-level security/);
  await identity(admin);
  await uploadAdminEvidence();
  await command("settings",{...config,commission_bps:1000});
  assert.equal((await read(id)).commission_bps,500);
  const companies = (await q("select public.finance_find_companies('Vendedora') result"))[0].result;
  assert.deepEqual(companies,[seller]);
  await identity(buyer);
  const second = await command("open",{negotiation_id:negotiation2,amount_cents:1000,commission_bps:1000});
  const id2=second.order_id;

  await identity("", "service_role");
  await assert.rejects(prepare(outsider,"link_seller",{company_id:seller,live:false,account_id:account}),/administrativo/);
  await assert.rejects(prepare(admin,"link_seller",{company_id:seller,live:false,account_id:account,admin_aal2:false}),/administrativo/);
  await assert.rejects(prepare(buyer,"checkout",{order_id:id,live:false}),/recebimento configurada/);
  await prepare(admin,"link_seller",{company_id:seller,live:false,account_id:account});
  await assert.rejects(prepare(seller,"checkout",{order_id:id,live:false}),/Somente o comprador/);
  await prepare(buyer,"checkout",{order_id:id,live:false});
  await prepare(buyer,"checkout",{order_id:id2,live:false});
  await prepare(buyer,"checkout_methods",{order_id:id,live:false,methods:["card"]});
  assert.deepEqual((await prepare(buyer,"checkout_methods",{order_id:id,live:false,methods:["pix"]})).gateway_selected_methods,["card"]);

  const snapshot = (status,event_key,fields={}) => ({ order_id:id, account, live:false, payment_id:"pi_fixture",
    amount_cents:770,currency:"brl",status,event_key,commission_cents:39,method:"card",...fields });
  await assert.rejects(event("payment",snapshot("approved","wrong-amount",{amount_cents:769})),/Valor ou moeda/);
  await assert.rejects(event("payment",snapshot("approved","wrong-account",{account:"acct_other"})),/incompatível/);
  await assert.rejects(event("payment",snapshot("approved","wrong-mode",{live:true})),/incompatível/);
  await assert.rejects(event("session",snapshot("open","unknown-session",{session_id:"cs_other"})),/vínculo/);
  await assert.rejects(event("payment",snapshot("approved","unbound-payment")),/sessão vinculada/);
  await event("session",snapshot("open","session",{session_id:"cs_fixture",trusted_creation:true}));
  await assert.rejects(event("payment",snapshot("approved","wrong-fee",{commission_cents:0})),/comissão/);
  await event("payment",snapshot("declined","declined"));
  await event("payment",snapshot("processing","processing"));
  await event("session",{ order_id:id2,account,live:false,amount_cents:1000,currency:"brl",
    status:"expired",event_key:"expired",session_id:"cs_expired",trusted_creation:true });

  await identity(buyer);
  assert.equal((await read(id2)).payment_status,"expired");
  assert.equal((await read(id)).payment_status,"processing");
  assert.equal((await read(id)).paid_at,null);
  await assert.rejects(command("receive",{order_id:id}),/indisponível/);

  await identity("","service_role");
  await event("payment",snapshot("approved","approved",{fee_cents:12}));
  await event("payment",snapshot("approved","approved",{fee_cents:12}));
  await event("payment",snapshot("declined","late-failure"));
  await event("payout",{ event_key:"payout-paid",account,live:false,currency:"brl",status:"paid",
    payout_id:"po_fixture",amount_cents:719,arrival_at:1780000000,observed_at:1780000000 });

  await identity(seller);
  assert.equal((await read(id)).payment_status,"approved");
  assert.equal((await q("select count(*)::integer total from public.finance_events where order_id=$1 and provider_key='approved'",[id]))[0].total,1);
  assert.equal((await q("select count(*)::integer total from public.finance_events where order_id=$1 and kind='payment_approved'",[id]))[0].total,1);
  assert.equal((await q("select status from public.finance_payouts"))[0].status,"paid");
  await command("prepare",{order_id:id});
  const evidencePath = `${id}/${seller}/comprovante-qa.pdf`;
  await q("insert into storage.objects(bucket_id,name,owner_id) values ('finance-evidence',$1,$2)",[evidencePath,seller]);
  assert.equal((await q("select id from storage.objects where name=$1",[evidencePath])).length,1);
  await identity(buyer);
  assert.equal((await q("select id from storage.objects where name=$1",[evidencePath])).length,0);
  await identity(seller);
  await command("ship",{order_id:id,tracking:"Transportadora fictícia",evidence_path:evidencePath});
  assert.equal((await read(id)).refund_deadline_at,null);
  await assert.rejects(command("receive",{order_id:id}),/Somente o comprador/);

  await identity(buyer);
  assert.equal((await q("select id from storage.objects where name=$1",[evidencePath])).length,1);
  await assert.rejects(command("refund_request",{order_id:id,amount_cents:200,reason:"quality",description:"Teste"}),/elegível/);
  const received = await command("receive",{order_id:id});
  const again = await command("receive",{order_id:id});
  assert.deepEqual(again,received);
  const delivered=await read(id);
  assert.equal(delivered.order_status,"delivered");
  assert.equal(new Date(delivered.refund_deadline_at)-new Date(delivered.received_at),168*3600000);
  const edge = await q(`select public.finance_in_refund_window('2026-11-01T00:00:00Z','2026-11-08T00:00:00Z','2026-11-08T00:00:00Z') exact,
    public.finance_in_refund_window('2026-11-01T00:00:00Z','2026-11-08T00:00:00Z','2026-11-08T00:00:00.000001Z') late`);
  assert.deepEqual(edge[0],{exact:true,late:false});
  await assert.rejects(q("update public.finance_orders set received_at=now() where id=$1",[id]),/permission denied/);

  const refundRequest={order_id:id,amount_cents:200,reason:"quality",description:"Divergência em teste"};
  const rejected=await command("refund_request",refundRequest);
  await assert.rejects(command("refund_request",refundRequest),/andamento/);
  await assert.rejects(command("refund_approve",{order_id:id,refund_id:rejected.refund_id,description:"Teste"}),/justificativa/);
  await identity(admin);
  await command("refund_reject",{order_id:id,refund_id:rejected.refund_id,description:"Falta comprovação."});
  await identity(buyer);
  const firstRefund=await command("refund_request",refundRequest);
  await identity(admin);
  await command("refund_approve",{order_id:id,refund_id:firstRefund.refund_id,description:"Aprovado em teste."});
  assert.equal((await read(id)).refunded_cents,0);

  await identity("","service_role");
  await prepare(admin,"refund",{order_id:id,refund_id:firstRefund.refund_id,live:false});
  await event("refund",snapshot("failed","failed-refund",{amount_cents:200,refund_id:firstRefund.refund_id,provider_refund:"re_failed"}));
  await identity(buyer);
  const partial=await command("refund_request",refundRequest);
  await identity(admin);
  await command("refund_approve",{order_id:id,refund_id:partial.refund_id,description:"Autoriza parcial."});
  await identity("","service_role");
  await prepare(admin,"refund",{order_id:id,refund_id:partial.refund_id,live:false});
  await event("payment",snapshot("approved","partial-payment",{refunded_cents:200,reversed_cents:10}));
  await event("refund",snapshot("succeeded","partial-refund",{amount_cents:200,refund_id:partial.refund_id,provider_refund:"re_partial"}));
  await event("refund",snapshot("succeeded","partial-refund",{amount_cents:200,refund_id:partial.refund_id,provider_refund:"re_partial"}));

  await identity(admin);
  assert.equal((await read(id)).refunded_cents,200);
  assert.equal((await read(id)).commission_reversed_cents,10);
  assert.equal((await read(id)).payment_status,"partially_refunded");
  await db.exec("reset role");
  await q("update public.finance_orders set received_at=statement_timestamp()-interval '169 hours', refund_deadline_at=statement_timestamp()-interval '1 hour' where id=$1",[id]);
  await identity(buyer);
  await assert.rejects(command("refund_request",{...refundRequest,amount_cents:570}),/elegível/);
  await identity(admin);
  await command("refund_exception",{...refundRequest,amount_cents:570,description:"Exceção administrativa justificada."});
  const [{id:lastId}] = await q("select id from public.finance_refunds where order_id=$1 and status='requested'",[id]);
  await command("refund_approve",{order_id:id,refund_id:lastId,description:"Autoriza o saldo."});
  await identity("","service_role");
  await prepare(admin,"refund",{order_id:id,refund_id:lastId,live:false});
  await event("payment",snapshot("approved","full-payment",{refunded_cents:770,reversed_cents:39}));
  await event("refund",snapshot("succeeded","full-refund",{amount_cents:570,refund_id:lastId,provider_refund:"re_full"}));
  await event("payment",snapshot("approved","older-payment",{refunded_cents:0,reversed_cents:0}));

  await identity(buyer);
  assert.equal((await read(id)).payment_status,"refunded");
  assert.equal((await read(id)).commission_reversed_cents,39);
  await command("dispute_open",{order_id:id,description:"Reclamação sobre a entrega."});
  assert.equal((await read(id)).order_status,"disputed");
  await identity(admin);
  await command("dispute_close",{order_id:id,description:"Registro analisado.",restore:"delivered"});
  assert.equal((await read(id)).order_status,"delivered");
  const [{result: stats}]=await q("select public.finance_summary('admin') result");
  assert.equal(stats.gross_cents,0);
  assert.equal(stats.payout_paid_cents,0);

  await identity(seller);
  const finalize = () => q("update public.negotiations set status='finalizado' where id=$1 returning status",[negotiation2]);
  await assert.rejects(finalize(),/Aguarde o comprador/);
  await assert.rejects(q("update public.negotiations set confirmed_payment_method='pix' where id=$1",[negotiation2]),/Somente o comprador/);
  await q("update public.produtos set is_free=true where id=$1",[product2]);
  await q("update public.negotiations set payment_required=false where id=$1",[negotiation2]);
  await assert.rejects(finalize(),/Aguarde o comprador/);

  await identity(buyer);
  await assert.rejects(q("update public.negotiations set confirmed_payment_method='invalid' where id=$1",[negotiation2]),/check constraint/);
  await q("update public.negotiations set confirmed_payment_method='pix' where id=$1",[negotiation2]);
  await assert.rejects(q("update public.negotiations set confirmed_payment_method='boleto' where id=$1",[negotiation2]),/Somente o comprador/);
  await identity(seller);
  assert.deepEqual(await finalize(),[{status:"finalizado"}]);

  const accept = (id) => q("update public.negotiations set status='aceito' where id=$1 returning status",[id]);
  const propose = (buyerId, unit) => q(`insert into public.negotiations(product_id,buyer_id,seller_id,status,proposed_unit)
    values ($1,$2,$3,'interesse',$4) returning id`,[freeProduct,buyerId,seller,unit]);
  await assert.rejects(accept(legacyProposal),/não tem unidade registrada/);
  await identity(buyer);
  await assert.rejects(propose(buyer,"t"),/Atualize o anúncio/);
  const [{id:oldProposal}] = await propose(buyer,"kg");
  await identity(seller);
  await q("update public.produtos set unit='t' where id=$1",[freeProduct]);
  await q("update public.negotiations set proposed_unit='t' where id=$1",[oldProposal]);
  assert.deepEqual(await q("select proposed_unit from public.negotiations where id=$1",[oldProposal]),[{proposed_unit:"kg"}]);
  await assert.rejects(accept(oldProposal),/A unidade do anúncio mudou/);
  assert.deepEqual(await q("select status from public.produtos where id=$1",[freeProduct]),[{status:"active"}]);
  await identity(buyer);
  const [{id:freeNegotiation}] = await propose(buyer,"t");
  await identity(outsider);
  const [{id:competingNegotiation}] = await propose(outsider,"t");
  await identity(seller);
  assert.deepEqual(await accept(freeNegotiation),[{status:"aceito"}]);
  assert.deepEqual(await q(`select accepted_quantity::integer as quantity, accepted_total_cents::integer as total,
    accepted_unit as unit, payment_required from public.negotiations where id=$1`,[freeNegotiation]),[
    {quantity:5,total:0,unit:"t",payment_required:false},
  ]);
  assert.deepEqual(await q("select status from public.produtos where id=$1",[freeProduct]),[{status:"sold"}]);
  await assert.rejects(accept(competingNegotiation),/lote já foi reservado/);
  await assert.rejects(q("update public.produtos set status='active' where id=$1",[freeProduct]),/lote já foi reservado/);
  assert.deepEqual(await q("select status from public.negotiations where id=$1",[competingNegotiation]),[{status:"interesse"}]);
  const [{status:freeStatus}] = await q("update public.negotiations set status='finalizado' where id=$1 returning status",[freeNegotiation]);
  assert.equal(freeStatus,"finalizado");

  await db.exec("reset role");
  await q("update public.companies set verified=true where id=$1",[seller]);
  await identity(seller);
  assert.deepEqual(await q("update public.companies set description='Atualização de perfil' where id=$1 returning verified",[seller]),[{verified:true}]);
  await identity(admin);
  const [{identity_revision:reviewed}] = await q("select identity_revision from public.list_companies_for_admin() where id=$1",[seller]);
  const verify = (revision) => q("select public.admin_set_company_verification($1,$2,true)",[seller,revision]);
  await identity(seller);
  assert.deepEqual(await q("update public.companies set company_name='Nome atualizado' where id=$1 returning verified",[seller]),[{verified:false}]);
  await assert.rejects(verify(reviewed),/autenticação administrativa em dois fatores/);
  await identity(admin);
  await assert.rejects(verify(reviewed),/cadastro continua atualizado/);
  await assert.rejects(q("update public.companies set verified=true where id=$1",[seller]),/painel administrativo/);
  const [{identity_revision:current}] = await q("select identity_revision from public.list_companies_for_admin() where id=$1",[seller]);
  assert.notEqual(current,reviewed);
  await verify(current);
  assert.deepEqual(await q("select verified from public.companies where id=$1",[seller]),[{verified:true}]);
});
