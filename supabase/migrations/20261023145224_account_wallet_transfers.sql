-- Internal Amoy test-token balances. No client issuance, deposits or withdrawals.
-- Only the server may call these RPCs after verifying the registered Active Key.
create table public.penora_account_balances (
  owner_id uuid not null references public.profiles(id) on delete restrict,
  asset text not null check (asset in ('USDT','PNR')),
  units numeric(78,0) not null default 0 check (units >= 0),
  primary key(owner_id,asset)
);
create table public.penora_account_transfers (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete restrict,
  recipient_id uuid not null references public.profiles(id) on delete restrict,
  asset text not null check (asset in ('USDT','PNR')),
  units numeric(78,0) not null check (units > 0),
  request_id uuid not null,
  created_at timestamptz not null default now(),
  unique(sender_id,request_id),
  check(sender_id <> recipient_id)
);
create index penora_transfers_sender_time on public.penora_account_transfers(sender_id,created_at desc);
create index penora_transfers_recipient_time on public.penora_account_transfers(recipient_id,created_at desc);
alter table public.penora_account_balances enable row level security;
alter table public.penora_account_transfers enable row level security;
revoke all on public.penora_account_balances, public.penora_account_transfers from public,anon,authenticated;
grant select,insert,update on public.penora_account_balances to service_role;
grant select,insert on public.penora_account_transfers to service_role;

create function public.penora_account_snapshot(p_owner uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select jsonb_build_object(
    'balances', jsonb_build_object(
      'PNR', coalesce((select units::text from public.penora_account_balances where owner_id=p_owner and asset='PNR'),'0'),
      'USDT', coalesce((select units::text from public.penora_account_balances where owner_id=p_owner and asset='USDT'),'0')),
    'transfers', coalesce((select jsonb_agg(t) from (
      select id,asset,units::text,created_at,
        case when sender_id=p_owner then 'sent' else 'received' end as direction,
        (select username from public.profiles where id=case when sender_id=p_owner then recipient_id else sender_id end) as counterparty
      from public.penora_account_transfers where sender_id=p_owner or recipient_id=p_owner
      order by created_at desc,id desc limit 30
    ) t),'[]'::jsonb));
$$;

create function public.penora_account_transfer(p_sender uuid,p_recipient text,p_asset text,p_units numeric,p_nonce uuid,p_active_key text,p_expires bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  receiver uuid;
  old public.penora_account_transfers%rowtype;
  balance numeric;
  transfer_id uuid;
begin
  if p_units is null or p_units <= 0 or p_units::text in ('NaN','Infinity','-Infinity') or p_units <> trunc(p_units) or p_units >= 1e36 or p_asset not in ('PNR','USDT') then
    raise exception 'Invalid amount';
  end if;
  if p_expires <= extract(epoch from clock_timestamp())*1000 then raise exception 'Request expired'; end if;
  -- Lock sender authority through commit, preventing a key-rotation race.
  perform 1 from public.account_authorities where account_id=p_sender and active_public_key=p_active_key for share;
  if not found then raise exception 'Active Key changed'; end if;
  select id into receiver from public.profiles where username=p_recipient;
  if receiver is null or receiver=p_sender then raise exception 'Recipient not found'; end if;
  -- Serialize duplicate request IDs across assets as well as concurrent sends.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_sender::text || ':' || p_nonce::text,0));
  select * into old from public.penora_account_transfers where sender_id=p_sender and request_id=p_nonce;
  if found then
    if old.recipient_id<>receiver or old.asset<>p_asset or old.units<>p_units then raise exception 'Request conflict'; end if;
    return jsonb_build_object('id',old.id,'recipient',p_recipient,'asset',p_asset,'units',old.units::text,'status','confirmed');
  end if;
  -- Create and lock accounts in UUID order to avoid crossed-transfer deadlocks.
  insert into public.penora_account_balances(owner_id,asset)
    select x,p_asset from unnest(array[p_sender,receiver]) x order by x
    on conflict do nothing;
  perform 1 from public.penora_account_balances where asset=p_asset and owner_id in (p_sender,receiver) order by owner_id for update;
  select units into balance from public.penora_account_balances where owner_id=p_sender and asset=p_asset;
  if balance < p_units then raise exception 'Insufficient account balance'; end if;
  update public.penora_account_balances set units=units-p_units where owner_id=p_sender and asset=p_asset;
  update public.penora_account_balances set units=units+p_units where owner_id=receiver and asset=p_asset;
  insert into public.penora_account_transfers(sender_id,recipient_id,asset,units,request_id)
    values(p_sender,receiver,p_asset,p_units,p_nonce) returning id into transfer_id;
  return jsonb_build_object('id',transfer_id,'recipient',p_recipient,'asset',p_asset,'units',p_units::text,'status','confirmed');
end;
$$;
revoke all on function public.penora_account_snapshot(uuid) from public,anon,authenticated;
revoke all on function public.penora_account_transfer(uuid,text,text,numeric,uuid,text,bigint) from public,anon,authenticated;
grant execute on function public.penora_account_snapshot(uuid) to service_role;
grant execute on function public.penora_account_transfer(uuid,text,text,numeric,uuid,text,bigint) to service_role;
