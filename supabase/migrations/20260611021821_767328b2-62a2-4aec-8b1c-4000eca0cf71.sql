REVOKE EXECUTE ON FUNCTION public.sync_order_status_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_order() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_order_status_chat() FROM PUBLIC, anon, authenticated;