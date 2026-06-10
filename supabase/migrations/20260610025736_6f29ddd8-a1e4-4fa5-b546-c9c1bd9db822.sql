
-- Orders: shipping info + quantity
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS shipping_address text,
  ADD COLUMN IF NOT EXISTS notes text;

-- Conversations: deeper customer analytics
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS customer_intent text,
  ADD COLUMN IF NOT EXISTS interested_categories text[],
  ADD COLUMN IF NOT EXISTS budget_range text,
  ADD COLUMN IF NOT EXISTS lead_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preferred_language text,
  ADD COLUMN IF NOT EXISTS summary text;

-- new_order notification trigger
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
    '/dashboard',
    jsonb_build_object('order_id', new.id, 'amount', new.amount, 'channel', new.channel));
  return new;
end; $$;

DROP TRIGGER IF EXISTS orders_new_order_notify ON public.orders;
CREATE TRIGGER orders_new_order_notify
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_new_order();
