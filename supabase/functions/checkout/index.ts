// Checkout endpoint - receives cart + shipping address from chat widget,
// creates orders, decrements stock. Notifications fire automatically via DB trigger.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type CartItem = { name: string; qty: number; price?: number };
interface Body {
  ownerId: string;
  conversationId?: string;
  customerName: string;
  customerPhone: string;
  shippingAddress: string;
  notes?: string;
  channel?: string;
  items: CartItem[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = (await req.json()) as Body;
    if (!body?.ownerId || !body?.items?.length || !body.customerName || !body.customerPhone || !body.shippingAddress) {
      return json({ error: "missing required fields" }, 400);
    }
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const createdOrders: any[] = [];
    let totalAmount = 0;
    const failures: string[] = [];

    for (const item of body.items) {
      const qty = Math.max(1, Math.floor(item.qty || 1));
      const { data: prod } = await admin
        .from("products")
        .select("id, name, price, stock")
        .eq("user_id", body.ownerId)
        .ilike("name", item.name)
        .maybeSingle();
      if (!prod) { failures.push(`${item.name} (ไม่พบในระบบ)`); continue; }
      if (prod.stock < qty) { failures.push(`${prod.name} (สต็อกเหลือ ${prod.stock})`); continue; }

      const amount = Number(prod.price) * qty;
      totalAmount += amount;
      await admin.from("products").update({ stock: prod.stock - qty }).eq("id", prod.id);
      const { data: order } = await admin.from("orders").insert({
        user_id: body.ownerId,
        order_number: "#A-" + Math.floor(10000 + Math.random() * 90000),
        customer_name: body.customerName,
        customer_phone: body.customerPhone,
        shipping_address: body.shippingAddress,
        notes: body.notes || null,
        product_name: prod.name,
        quantity: qty,
        amount,
        closed_by_ai: true,
        channel: (body.channel as any) || "web_widget",
        status: "pending",
      }).select().single();
      if (order) createdOrders.push(order);
    }

    // Add a system message to the conversation summarizing the order
    if (body.conversationId && createdOrders.length) {
      const summary = `✅ รับออเดอร์เรียบร้อย\n${createdOrders.map((o: any) => `• ${o.product_name} x${o.quantity} = ฿${o.amount}`).join("\n")}\nยอดรวม: ฿${totalAmount.toLocaleString()}\nจัดส่งถึง: ${body.shippingAddress}`;
      await admin.from("messages").insert({
        conversation_id: body.conversationId,
        user_id: body.ownerId,
        sender: "ai",
        content: summary,
      });
      await admin.from("conversations").update({
        last_message: summary,
        last_message_at: new Date().toISOString(),
      }).eq("id", body.conversationId);
    }

    return json({
      success: createdOrders.length > 0,
      orders: createdOrders,
      totalAmount,
      failures,
    });
  } catch (e) {
    console.error("checkout error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}