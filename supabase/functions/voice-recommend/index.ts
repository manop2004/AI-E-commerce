// Voice-AI product recommendation
// Input: { ownerId, transcript }
// Returns: { items: [{id, name, price, stock, image_url, reason}] }
// Uses Lovable AI to analyse the live phone-call transcript and pick the
// best-matching products from the user's catalog.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { ownerId, transcript } = await req.json();
    if (!ownerId || !transcript || String(transcript).trim().length < 3) {
      return json({ items: [] });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY missing" }, 500);
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: products } = await admin
      .from("products")
      .select("id,name,price,stock,image_url,category,description,sku")
      .eq("user_id", ownerId)
      .eq("status", "active")
      .gt("stock", 0)
      .limit(200);

    if (!products || products.length === 0) return json({ items: [] });

    // Pull training docs to help understanding (FAQ/brand voice/promo)
    const { data: docs } = await admin
      .from("training_documents")
      .select("title, doc_type, content")
      .eq("user_id", ownerId)
      .limit(10);
    const knowledge = (docs || [])
      .map((d: any) => `# ${d.title} (${d.doc_type})\n${(d.content || "").slice(0, 600)}`)
      .join("\n")
      .slice(0, 3000);

    const catalog = products
      .map((p: any, i: number) =>
        `[${i}] id=${p.id} | ${p.name}${p.category ? ` (${p.category})` : ""} | ฿${p.price} | สต็อก ${p.stock}${p.sku ? ` | SKU ${p.sku}` : ""}${p.description ? ` | ${String(p.description).slice(0, 120)}` : ""}`
      )
      .join("\n");

    const system = `คุณคือผู้ช่วยขายทางโทรศัพท์ ภารกิจ: ฟังคำพูดล่าสุดของลูกค้า แล้วเลือกสินค้าจาก CATALOG ที่ตรงกับสิ่งที่ลูกค้าต้องการมากที่สุด 0-4 รายการเท่านั้น
- ถ้าลูกค้ายังไม่ได้พูดถึงสินค้าเฉพาะ ให้ตอบ items: []
- ห้ามแต่งสินค้าที่ไม่อยู่ใน CATALOG
- ตอบเป็น JSON ตามรูปแบบที่กำหนดเท่านั้น ห้ามมีข้อความอื่น

CATALOG:
${catalog}

${knowledge ? `KNOWLEDGE BASE:\n${knowledge}` : ""}`;

    const user = `ลูกค้าพูดว่า: "${String(transcript).slice(-600)}"
เลือกสินค้าที่ตรงที่สุดสูงสุด 4 รายการจาก CATALOG เท่านั้น`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "recommend_products",
              description: "Return matched products from the catalog with a short reason for each.",
              parameters: {
                type: "object",
                properties: {
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", description: "id from CATALOG" },
                        reason: { type: "string", description: "ทำไมตรงกับคำพูดของลูกค้า (สั้น ๆ ภาษาไทย)" },
                      },
                      required: ["id", "reason"],
                    },
                  },
                },
                required: ["items"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "recommend_products" } },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI gateway error", aiRes.status, t);
      if (aiRes.status === 429) return json({ error: "rate_limited", items: [] }, 429);
      if (aiRes.status === 402) return json({ error: "credits_exhausted", items: [] }, 402);
      return json({ items: [] });
    }
    const aiJson = await aiRes.json();
    const call = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    let parsed: { items?: { id: string; reason: string }[] } = {};
    try {
      parsed = JSON.parse(call?.function?.arguments || "{}");
    } catch (e) {
      console.error("Parse tool args failed", e);
    }
    const byId = new Map(products.map((p: any) => [p.id, p]));
    const items = (parsed.items || [])
      .map((x) => {
        const p: any = byId.get(x.id);
        if (!p) return null;
        return {
          id: p.id,
          name: p.name,
          price: p.price,
          stock: p.stock,
          image_url: p.image_url,
          category: p.category,
          reason: x.reason || "ตรงกับสิ่งที่ลูกค้าพูด",
        };
      })
      .filter(Boolean)
      .slice(0, 4);
    return json({ items });
  } catch (e: any) {
    console.error("voice-recommend error", e);
    return json({ error: e?.message || "internal", items: [] }, 500);
  }
});