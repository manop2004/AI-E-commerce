-- ============ ENUMS ============
create type public.app_role as enum ('admin', 'customer');
create type public.integration_provider as enum ('shopify','woocommerce','lazada','shopee','line_oa','messenger','instagram','web_widget');
create type public.integration_status as enum ('connected','disconnected','error');
create type public.bot_feature_key as enum (
  'sales_search','sales_recommend','sales_crosssell','sales_bundle','sales_dynamic_pricing',
  'cs_chat_24_7','cs_order_check','cs_tracking','cs_faq','cs_multilang',
  'ops_stock','ops_process_order','ops_warranty','ops_reorder','ops_fraud',
  'mkt_segment','mkt_promo','mkt_cart_recovery','mkt_churn','mkt_ads_audience'
);
create type public.conversation_status as enum ('active','resolved','human_takeover');
create type public.lead_tag as enum ('hot','warm','cold');
create type public.subscription_plan as enum ('free','starter','growth','enterprise');
create type public.subscription_status as enum ('active','past_due','canceled','trialing');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  company_name text,
  avatar_url text,
  locale text not null default 'th',
  bot_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider public.integration_provider not null,
  status public.integration_status not null default 'disconnected',
  store_name text,
  config jsonb not null default '{}'::jsonb,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, provider)
);
alter table public.integrations enable row level security;

create table public.bot_features (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_key public.bot_feature_key not null,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, feature_key)
);
alter table public.bot_features enable row level security;

create table public.training_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  doc_type text not null,
  title text not null,
  content text,
  url text,
  status text not null default 'ready',
  created_at timestamptz not null default now()
);
alter table public.training_documents enable row level security;

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_name text not null,
  customer_avatar text,
  channel public.integration_provider not null,
  status public.conversation_status not null default 'active',
  lead_tag public.lead_tag,
  last_message text,
  last_message_at timestamptz not null default now(),
  unread_count int not null default 0,
  external_id text,
  created_at timestamptz not null default now()
);
alter table public.conversations enable row level security;
create index idx_conversations_user_channel_external on public.conversations(user_id, channel, external_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sender text not null check (sender in ('customer','ai','human')),
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_number text not null,
  customer_name text not null,
  product_name text not null,
  amount numeric(12,2) not null,
  closed_by_ai boolean not null default true,
  channel public.integration_provider,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);
alter table public.orders enable row level security;

create table public.daily_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  metric_date date not null,
  revenue numeric(12,2) not null default 0,
  ai_revenue numeric(12,2) not null default 0,
  chats_count int not null default 0,
  orders_count int not null default 0,
  conversion_rate numeric(5,2) not null default 0,
  new_customers int not null default 0,
  returning_customers int not null default 0,
  avg_response_seconds int not null default 0,
  csat numeric(3,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, metric_date)
);
alter table public.daily_metrics enable row level security;

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  plan public.subscription_plan not null default 'free',
  status public.subscription_status not null default 'active',
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null default (now() + interval '30 days'),
  amount numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_number text not null,
  amount numeric(10,2) not null,
  status text not null default 'paid',
  pdf_url text,
  created_at timestamptz not null default now()
);
alter table public.invoices enable row level security;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  sku text,
  price numeric not null default 0,
  compare_at_price numeric,
  stock integer not null default 0,
  low_stock_threshold integer not null default 5,
  image_url text,
  category text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.products enable row level security;
create index idx_products_user on public.products(user_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null,
  title text not null,
  message text,
  link text,
  metadata jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
create index idx_notifications_user_created on public.notifications(user_id, created_at desc);

-- ============ POLICIES ============
create policy "users view own profile" on public.profiles for select using (auth.uid() = id);
create policy "admins view all profiles" on public.profiles for select using (public.has_role(auth.uid(),'admin'));
create policy "users update own profile" on public.profiles for update using (auth.uid() = id);
create policy "users insert own profile" on public.profiles for insert with check (auth.uid() = id);

create policy "users view own roles" on public.user_roles for select using (auth.uid() = user_id);
create policy "admins view all roles" on public.user_roles for select using (public.has_role(auth.uid(),'admin'));
create policy "admins manage roles" on public.user_roles for all using (public.has_role(auth.uid(),'admin'));

create policy "own integrations" on public.integrations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "admin view integrations" on public.integrations for select using (public.has_role(auth.uid(),'admin'));
create policy "own bot_features" on public.bot_features for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own training" on public.training_documents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own conversations" on public.conversations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own messages" on public.messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own orders" on public.orders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "admin view orders" on public.orders for select using (public.has_role(auth.uid(),'admin'));
create policy "own metrics" on public.daily_metrics for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "admin view metrics" on public.daily_metrics for select using (public.has_role(auth.uid(),'admin'));
create policy "own subscription" on public.subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "admin view subscriptions" on public.subscriptions for select using (public.has_role(auth.uid(),'admin'));
create policy "own invoices" on public.invoices for select using (auth.uid() = user_id);
create policy "own products" on public.products for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own notifications" on public.notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============ FUNCTIONS / TRIGGERS ============
create or replace function public.touch_updated_at()
returns trigger language plpgsql security invoker set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger bot_features_touch before update on public.bot_features for each row execute function public.touch_updated_at();
create trigger products_updated_at before update on public.products for each row execute function public.touch_updated_at();

create or replace function public.seed_demo_data_for(uid uuid)
returns void language plpgsql security definer set search_path = public
as $function$
declare
  i int;
  conv_id uuid;
begin
  if uid is null then return; end if;
  if exists (select 1 from public.orders where user_id = uid limit 1) then return; end if;

  for i in 0..29 loop
    insert into public.daily_metrics(user_id, metric_date, revenue, ai_revenue, chats_count, orders_count, conversion_rate, new_customers, returning_customers, avg_response_seconds, csat)
    values (uid, current_date - i,
      40000 + (random()*60000)::numeric(12,2),
      25000 + (random()*40000)::numeric(12,2),
      80 + (random()*200)::int,
      10 + (random()*40)::int,
      (8 + random()*7)::numeric(5,2),
      (5 + random()*20)::int,
      (10 + random()*30)::int,
      (3 + random()*8)::int,
      (4.2 + random()*0.7)::numeric(3,2)
    ) on conflict do nothing;
  end loop;

  insert into public.orders(user_id, order_number, customer_name, product_name, amount, closed_by_ai, channel) values
    (uid,'#A-10293','Somchai P.','iPhone 15 Pro 256GB', 42900, true, 'shopify'),
    (uid,'#A-10294','Praew K.','MacBook Air M3', 39900, true, 'line_oa'),
    (uid,'#A-10295','Niran T.','AirPods Pro 2', 8990, true, 'messenger'),
    (uid,'#A-10296','Mali S.','iPad Air', 24900, false, 'web_widget'),
    (uid,'#A-10297','Kris W.','Sony WH-1000XM5', 12900, true, 'shopify'),
    (uid,'#A-10298','Jane D.','Galaxy S24 Ultra', 45900, true, 'line_oa'),
    (uid,'#A-10299','Tom R.','Apple Watch Ultra 2', 31900, true, 'instagram');

  insert into public.conversations(user_id, customer_name, channel, status, lead_tag, last_message, unread_count)
    values (uid,'Somchai P.','line_oa','active','hot','สนใจ iPhone 15 Pro มีสีไหนบ้างคะ',2)
    returning id into conv_id;
  insert into public.messages(conversation_id, user_id, sender, content) values
    (conv_id, uid, 'customer','สวัสดีครับ สนใจ iPhone 15 Pro'),
    (conv_id, uid, 'ai','สวัสดีค่ะ iPhone 15 Pro มี 4 สีค่ะ ต้องการความจุเท่าไหร่ดีคะ?'),
    (conv_id, uid, 'customer','256GB ครับ มีสต็อกไหม'),
    (conv_id, uid, 'ai','มีค่ะ ราคา 42,900 บาท ต้องการสั่งเลยไหมคะ?');

  insert into public.conversations(user_id, customer_name, channel, status, lead_tag, last_message, unread_count)
    values (uid,'Praew K.','messenger','active','warm','ขอเช็คราคา MacBook หน่อยค่ะ',1)
    returning id into conv_id;
  insert into public.messages(conversation_id, user_id, sender, content) values
    (conv_id, uid, 'customer','ขอเช็คราคา MacBook Air M3 หน่อยค่ะ'),
    (conv_id, uid, 'ai','MacBook Air M3 ราคา 39,900 บาทค่ะ มีโปรผ่อน 0% ด้วยนะคะ');

  insert into public.conversations(user_id, customer_name, channel, status, lead_tag, last_message, unread_count)
    values (uid,'Mali S.','web_widget','human_takeover','hot','ขอคุยกับเจ้าหน้าที่หน่อย',3)
    returning id into conv_id;
  insert into public.messages(conversation_id, user_id, sender, content) values
    (conv_id, uid, 'customer','ขอคุยกับเจ้าหน้าที่หน่อยค่ะ'),
    (conv_id, uid, 'ai','รับทราบค่ะ กำลังโอนสายให้เจ้าหน้าที่นะคะ');

  insert into public.integrations(user_id, provider, status, store_name, connected_at) values
    (uid,'shopify','connected','my-store.myshopify.com', now()),
    (uid,'line_oa','connected','@mybrand', now()),
    (uid,'messenger','disconnected', null, null),
    (uid,'web_widget','disconnected', null, null)
  on conflict (user_id, provider) do nothing;

  insert into public.training_documents(user_id, doc_type, title) values
    (uid,'pdf','Catalog 2026.pdf'),
    (uid,'excel','Products-Inventory.xlsx'),
    (uid,'faq','คำถามที่พบบ่อย v3'),
    (uid,'tone','Brand Voice Guidelines');
end;
$function$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));
  insert into public.user_roles (user_id, role) values (new.id, 'customer');
  insert into public.subscriptions (user_id, plan) values (new.id, 'free');
  insert into public.bot_features (user_id, feature_key, enabled)
  select new.id, k, true from unnest(enum_range(null::public.bot_feature_key)) as k;
  begin
    perform public.seed_demo_data_for(new.id);
  exception when others then
    raise log 'seed_demo_data_for failed for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.check_low_stock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.stock <= new.low_stock_threshold and (tg_op = 'INSERT' or old.stock > new.low_stock_threshold) then
    insert into public.notifications (user_id, type, title, message, link, metadata)
    values (new.user_id, 'low_stock',
      case when new.stock = 0 then 'สินค้าหมดสต็อก' else 'สต็อกใกล้หมด' end,
      new.name || ' เหลือ ' || new.stock || ' ชิ้น',
      '/dashboard/products',
      jsonb_build_object('product_id', new.id, 'stock', new.stock));
  end if;
  return new;
end; $$;
create trigger products_low_stock_check after insert or update of stock on public.products for each row execute function public.check_low_stock();

create or replace function public.notify_human_takeover()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'human_takeover' and (tg_op = 'INSERT' or old.status is distinct from 'human_takeover') then
    insert into public.notifications (user_id, type, title, message, link, metadata)
    values (new.user_id,'human_takeover','ลูกค้าขอคุยกับพนักงาน',
      new.customer_name || ' (' || new.channel || ') กำลังรอเจ้าหน้าที่',
      '/dashboard/livechat',
      jsonb_build_object('conversation_id', new.id));
  end if;
  return new;
end; $$;
create trigger conversations_takeover_notify after insert or update of status on public.conversations for each row execute function public.notify_human_takeover();

-- Realtime
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.notifications;
alter table public.notifications replica identity full;

-- Grants for SECURITY DEFINER
revoke execute on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
revoke execute on function public.seed_demo_data_for(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.check_low_stock() from public, anon, authenticated;
revoke execute on function public.notify_human_takeover() from public, anon, authenticated;

-- Storage
insert into storage.buckets (id, name, public) values ('product-images','product-images', true)
on conflict (id) do nothing;

create policy "Public read product images" on storage.objects
  for select using (bucket_id = 'product-images');
create policy "Users upload own product images" on storage.objects
  for insert with check (bucket_id = 'product-images' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users update own product images" on storage.objects
  for update using (bucket_id = 'product-images' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users delete own product images" on storage.objects
  for delete using (bucket_id = 'product-images' and auth.uid()::text = (storage.foldername(name))[1]);
