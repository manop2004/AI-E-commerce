import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const body = await req.json();
    const ownerId = String(body.ownerId || "").trim();
    const orderNumber = String(body.orderNumber || "").trim();
    const phone = normalizePhone(String(body.phone || ""));

    if (!ownerId || !orderNumber || phone.length < 4) return json({ error: "กรุณากรอกเลขออเดอร์และเบอร์โทร" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await admin
      .from("orders")
      .select("order_number, customer_name, product_name, quantity, amount, fulfillment_status, payment_status, tracking_number, tracking_url, shipping_address, status_updated_at, created_at, customer_phone")
      .eq("user_id", ownerId)
      .eq("order_number", orderNumber)
      .order("created_at", { ascending: true });

    if (error) throw error;
    const orders = (data || []).filter((o: any) => normalizePhone(o.customer_phone || "").endsWith(phone.slice(-6)) || normalizePhone(o.customer_phone || "") === phone);
    return json({ orders: orders.map(({ customer_phone, ...safe }: any) => safe) });
  } catch (e) {
    console.error("order-lookup error", e);
    return json({ error: e instanceof Error ? e.message : "ค้นหาไม่สำเร็จ" }, 500);
  }
});

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}