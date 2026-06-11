import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_STATUS = new Set(["pending", "paid", "preparing", "packed", "shipped", "delivered", "cancelled"]);
const ALLOWED_PAYMENT = new Set(["unpaid", "pending", "paid", "refunded"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "กรุณาเข้าสู่ระบบ" }, 401);

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: auth } = await userClient.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return json({ error: "กรุณาเข้าสู่ระบบ" }, 401);

    const body = await req.json();
    const orderId = String(body.orderId || "").trim();
    const fulfillmentStatus = String(body.fulfillment_status || "pending").trim();
    const paymentStatus = String(body.payment_status || "unpaid").trim();
    if (!orderId || !ALLOWED_STATUS.has(fulfillmentStatus) || !ALLOWED_PAYMENT.has(paymentStatus)) return json({ error: "ข้อมูลสถานะไม่ถูกต้อง" }, 400);

    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: before, error: beforeErr } = await admin
      .from("orders")
      .select("id, user_id, channel, conversation_id, order_number, product_name, customer_name, fulfillment_status, tracking_number, tracking_url")
      .eq("id", orderId)
      .eq("user_id", userId)
      .maybeSingle();
    if (beforeErr) throw beforeErr;
    if (!before) return json({ error: "ไม่พบออเดอร์" }, 404);

    const { data: order, error } = await admin
      .from("orders")
      .update({
        fulfillment_status: fulfillmentStatus,
        status: fulfillmentStatus,
        payment_status: paymentStatus,
        tracking_number: clean(body.tracking_number),
        tracking_url: clean(body.tracking_url),
      })
      .eq("id", orderId)
      .eq("user_id", userId)
      .select("*, conversations(external_id, channel)")
      .single();
    if (error) throw error;

    const externalSent = await sendExternalStatus(admin, userId, order);
    return json({ success: true, order, externalSent });
  } catch (e) {
    console.error("order-status error", e);
    return json({ error: e instanceof Error ? e.message : "อัปเดตสถานะไม่สำเร็จ" }, 500);
  }
});

function clean(value: unknown) {
  const text = String(value || "").trim();
  return text || null;
}

async function sendExternalStatus(admin: any, userId: string, order: any) {
  const channel = order?.conversations?.channel || order?.channel;
  const externalId = order?.conversations?.external_id;
  if (!externalId) return false;
  const message = buildStatusMessage(order);

  if (channel === "line_oa") {
    const { data: integ } = await admin.from("integrations").select("config").eq("user_id", userId).eq("provider", "line_oa").maybeSingle();
    const token = integ?.config?.access_token;
    if (!token) return false;
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to: externalId, messages: [{ type: "text", text: message }] }),
    });
    return res.ok;
  }

  if (channel === "messenger" || channel === "instagram") {
    const { data: integ } = await admin.from("integrations").select("config").eq("user_id", userId).eq("provider", channel).maybeSingle();
    const token = integ?.config?.page_access_token;
    if (!token) return false;
    const res = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: { id: externalId }, message: { text: message }, messaging_type: "UPDATE" }),
    });
    return res.ok;
  }

  return false;
}

function buildStatusMessage(order: any) {
  const labels: Record<string, string> = {
    pending: "รอยืนยัน",
    paid: "ชำระเงินแล้ว",
    preparing: "กำลังจัดเตรียมสินค้า",
    packed: "แพ็กสินค้าเรียบร้อย",
    shipped: "ส่งแล้ว",
    delivered: "จัดส่งสำเร็จ",
    cancelled: "ยกเลิกออเดอร์",
  };
  let msg = `📦 อัปเดตคำสั่งซื้อ ${order.order_number}\nสินค้า: ${order.product_name}\nสถานะ: ${labels[order.fulfillment_status] || order.fulfillment_status}`;
  if (order.tracking_number) msg += `\nเลขพัสดุ: ${order.tracking_number}`;
  if (order.tracking_url) msg += `\nติดตามพัสดุ: ${order.tracking_url}`;
  return msg;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}