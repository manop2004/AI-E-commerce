ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fulfillment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS tracking_url text,
  ADD COLUMN IF NOT EXISTS status_updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_orders_user_created ON public.orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_conversation ON public.orders(conversation_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number_phone ON public.orders(order_number, customer_phone);

CREATE OR REPLACE FUNCTION public.sync_order_status_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if new.fulfillment_status is null then
    new.fulfillment_status := coalesce(new.status, 'pending');
  end if;

  if tg_op = 'INSERT' then
    new.status := coalesce(new.status, new.fulfillment_status, 'pending');
    new.fulfillment_status := coalesce(new.fulfillment_status, new.status, 'pending');
    new.status_updated_at := now();
  elsif old.fulfillment_status is distinct from new.fulfillment_status
     or old.tracking_number is distinct from new.tracking_number
     or old.tracking_url is distinct from new.tracking_url
     or old.status is distinct from new.status then
    new.status := coalesce(new.fulfillment_status, new.status, 'pending');
    new.fulfillment_status := coalesce(new.fulfillment_status, new.status, 'pending');
    new.status_updated_at := now();
    if new.fulfillment_status = 'shipped' and old.fulfillment_status is distinct from 'shipped' then
      new.shipped_at := coalesce(new.shipped_at, now());
    end if;
  end if;

  return new;
end; $$;

DROP TRIGGER IF EXISTS orders_sync_status_fields ON public.orders;
CREATE TRIGGER orders_sync_status_fields
BEFORE INSERT OR UPDATE OF status, fulfillment_status, tracking_number, tracking_url ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.sync_order_status_fields();

CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  insert into public.notifications (user_id, type, title, message, link, metadata)
  values (new.user_id, 'new_order',
    'มีออเดอร์ใหม่ ' || new.order_number,
    new.customer_name || ' สั่ง ' || new.product_name || ' จำนวน ' || coalesce(new.quantity,1) || ' ชิ้น (฿' || new.amount || ')',
    '/dashboard/orders',
    jsonb_build_object('order_id', new.id, 'amount', new.amount, 'channel', new.channel));
  return new;
end; $$;

DROP TRIGGER IF EXISTS orders_new_order_notify ON public.orders;
CREATE TRIGGER orders_new_order_notify
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_new_order();

CREATE OR REPLACE FUNCTION public.notify_order_status_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  status_label text;
  msg text;
begin
  if new.conversation_id is null then
    return new;
  end if;

  if old.fulfillment_status is not distinct from new.fulfillment_status
     and old.tracking_number is not distinct from new.tracking_number
     and old.tracking_url is not distinct from new.tracking_url then
    return new;
  end if;

  status_label := case new.fulfillment_status
    when 'pending' then 'รอชำระเงิน/รอยืนยัน'
    when 'paid' then 'ชำระเงินแล้ว'
    when 'preparing' then 'กำลังจัดเตรียมสินค้า'
    when 'packed' then 'แพ็กสินค้าเรียบร้อย'
    when 'shipped' then 'ส่งแล้ว'
    when 'delivered' then 'จัดส่งสำเร็จ'
    when 'cancelled' then 'ยกเลิกออเดอร์'
    else new.fulfillment_status
  end;

  msg := '📦 อัปเดตคำสั่งซื้อ ' || new.order_number || E'\n'
      || 'สินค้า: ' || new.product_name || E'\n'
      || 'สถานะ: ' || status_label;

  if coalesce(new.tracking_number, '') <> '' then
    msg := msg || E'\nเลขพัสดุ: ' || new.tracking_number;
  end if;
  if coalesce(new.tracking_url, '') <> '' then
    msg := msg || E'\nติดตามพัสดุ: ' || new.tracking_url;
  end if;

  insert into public.messages (conversation_id, user_id, sender, content)
  values (new.conversation_id, new.user_id, 'ai', msg);

  update public.conversations
  set last_message = msg,
      last_message_at = now()
  where id = new.conversation_id;

  insert into public.notifications (user_id, type, title, message, link, metadata)
  values (new.user_id, 'order_status', 'อัปเดตสถานะ ' || new.order_number, status_label, '/dashboard/orders', jsonb_build_object('order_id', new.id, 'status', new.fulfillment_status));

  return new;
end; $$;

DROP TRIGGER IF EXISTS orders_status_chat_notify ON public.orders;
CREATE TRIGGER orders_status_chat_notify
AFTER UPDATE OF fulfillment_status, tracking_number, tracking_url ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_order_status_chat();

DO $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  end if;
end $$;