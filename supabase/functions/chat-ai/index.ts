// AI chat edge function - generates AI replies using Lovable AI Gateway
// Uses training documents + bot features as context, saves to messages table.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ReqBody {
  conversationId?: string;
  customerName?: string;
  channel?: string;
  message: string;
  ownerId?: string; // for public widget mode
  history?: { role: "user" | "assistant"; content: string }[];
  saveToDb?: boolean; // default true if conversationId set
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as ReqBody;
    if (!body?.message?.trim()) {
      return json({ error: "message required" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Resolve owner: either authenticated user or explicit ownerId (widget mode)
    let ownerId = body.ownerId;
    let conversationId = body.conversationId;
    let userMessageContent = body.message;

    const authHeader = req.headers.get("Authorization");
    if (!ownerId && authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data } = await userClient.auth.getUser(token);
      if (data?.user) ownerId = data.user.id;
    }
    if (!ownerId) return json({ error: "owner not resolved" }, 401);

    // Pull training documents (limit to small context)
    const { data: docs } = await admin
      .from("training_documents")
      .select("title, doc_type, content")
      .eq("user_id", ownerId)
      .limit(20);

    // Pull profile/company name + master bot switch + locale
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, company_name, bot_enabled, locale")
      .eq("id", ownerId)
      .maybeSingle();

    // Pull per-feature toggles
    const { data: featRows } = await admin
      .from("bot_features")
      .select("feature_key, enabled")
      .eq("user_id", ownerId);
    const feat: Record<string, boolean> = {};
    (featRows || []).forEach((r: any) => { feat[r.feature_key] = r.enabled; });
    const on = (k: string) => feat[k] !== false; // default on if missing

    // Resolve per-channel reply mode (auto | human_only | trained_only)
    let replyMode: "auto" | "human_only" | "trained_only" = "auto";
    const channelKey = (body.channel as string) || "web_widget";
    if (channelKey) {
      const { data: integ } = await admin
        .from("integrations")
        .select("reply_mode")
        .eq("user_id", ownerId)
        .eq("provider", channelKey as any)
        .maybeSingle();
      if (integ?.reply_mode) replyMode = integ.reply_mode as any;
    }

    const silentlyStoreAndExit = async (reason: string) => {
      if (conversationId) {
        await admin.from("messages").insert({
          conversation_id: conversationId,
          user_id: ownerId,
          sender: "customer",
          content: userMessageContent,
        });
        await admin
          .from("conversations")
          .update({
            last_message: userMessageContent,
            last_message_at: new Date().toISOString(),
            status: "human_takeover",
            unread_count: 1,
          })
          .eq("id", conversationId);
      } else if (body.customerName) {
        // create conversation for human follow-up
        const { data: conv } = await admin
          .from("conversations")
          .insert({
            user_id: ownerId,
            customer_name: body.customerName,
            channel: channelKey as any,
            last_message: userMessageContent,
            status: "human_takeover",
            unread_count: 1,
          })
          .select()
          .single();
        if (conv) {
          conversationId = conv.id;
          await admin.from("messages").insert({
            conversation_id: conv.id,
            user_id: ownerId,
            sender: "customer",
            content: userMessageContent,
          });
        }
      }
      return json({ reply: "", skipped: true, reason, conversationId: conversationId ?? null });
    };

    // MASTER BOT SWITCH: if owner turned bot off → silent, store for human.
    if (profile && profile.bot_enabled === false) {
      return await silentlyStoreAndExit("bot_disabled");
    }
    // Per-channel human-only mode: bot stays silent, message goes to human queue.
    if (replyMode === "human_only") {
      return await silentlyStoreAndExit("channel_human_only");
    }
    // If "ตอบแชท 24/7" feature is OFF → bot is paused entirely.
    if (feat["cs_chat_24_7"] === false) {
      return await silentlyStoreAndExit("chat_feature_disabled");
    }

    // Build conversation history + resolve customer name from conversation
    let history: { role: string; content: string }[] = [];
    let resolvedCustomerName = body.customerName;
    if (conversationId) {
      const { data: conv } = await admin.from("conversations").select("customer_name").eq("id", conversationId).maybeSingle();
      if (conv?.customer_name && !resolvedCustomerName) resolvedCustomerName = conv.customer_name;
      const { data: prev } = await admin
        .from("messages")
        .select("sender, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(30);
      history = (prev || []).map((m: any) => ({
        role: m.sender === "customer" ? "user" : "assistant",
        content: m.content,
      }));
    } else if (body.history) {
      history = body.history.map((h) => ({ role: h.role, content: h.content }));
    }

    const trainingContext = (docs || [])
      .map((d: any) => `### ${d.title} (${d.doc_type})\n${d.content || "(no inline content)"}`)
      .join("\n\n")
      .slice(0, 6000);

    // Pull store's own products from DB
    let catalogContext = "";
    const { data: ownProducts } = await admin
      .from("products")
      .select("name, description, price, stock, category, sku, image_url")
      .eq("user_id", ownerId)
      .eq("status", "active")
      .gt("stock", 0)
      .limit(50);
    if (ownProducts && ownProducts.length) {
      catalogContext = ownProducts
        .map((p: any) => `- ${p.name}${p.category ? ` [${p.category}]` : ""} | ฿${p.price} | สต็อก ${p.stock} ชิ้น${p.sku ? ` | SKU:${p.sku}` : ""}${p.image_url ? ` | IMG:${p.image_url}` : ""} — ${(p.description || "").slice(0, 120)}`)
        .join("\n");
    }

    // Pull this customer's purchase history from orders (match by name)
    let purchaseHistory = "";
    if (resolvedCustomerName) {
      const { data: orders } = await admin
        .from("orders")
        .select("product_name, amount, channel, created_at")
        .eq("user_id", ownerId)
        .ilike("customer_name", resolvedCustomerName)
        .order("created_at", { ascending: false })
        .limit(10);
      if (orders && orders.length) {
        purchaseHistory = orders
          .map((o: any) => `- ${o.product_name} (${o.amount} บาท, ${o.channel || "-"})`)
          .join("\n");
      }
    }

    // Language hint
    const LOCALE_NAMES: Record<string, string> = {
      th: "Thai", en: "English", zh: "Simplified Chinese", "zh-TW": "Traditional Chinese",
      ja: "Japanese", ko: "Korean", vi: "Vietnamese", id: "Indonesian", ms: "Malay",
      tl: "Filipino", hi: "Hindi", ar: "Arabic", es: "Spanish", pt: "Portuguese",
      fr: "French", de: "German", ru: "Russian", it: "Italian", tr: "Turkish", nl: "Dutch",
    };
    const localeKey = (profile?.locale || "th").toString();
    const localeName = LOCALE_NAMES[localeKey] || LOCALE_NAMES[localeKey.split("-")[0]] || "Thai";

    // Build dynamic capability rules from per-feature toggles
    const capRules: string[] = [];
    // Sales
    capRules.push(on("sales_search") ? "- ✅ ค้นหาสินค้าให้ลูกค้าได้เมื่อถูกถาม" : "- ❌ ห้ามค้นหา/แสดงรายการสินค้าให้ลูกค้า ให้แจ้งว่าฟีเจอร์นี้ปิดอยู่");
    capRules.push(on("sales_recommend") ? "- ✅ แนะนำสินค้าจาก CATALOG ได้" : "- ❌ ห้ามแนะนำสินค้าใดๆ แม้ลูกค้าจะถาม");
    capRules.push(on("sales_crosssell") ? "- ✅ เสนอ Cross-sell / Upsell ได้" : "- ❌ ห้ามเสนอ Cross-sell หรือ Upsell");
    capRules.push(on("sales_bundle") ? "- ✅ เสนอ Bundle รวมสินค้าได้" : "- ❌ ห้ามเสนอ Bundle");
    capRules.push(on("sales_dynamic_pricing") ? "- ✅ เสนอส่วนลด/ราคาพิเศษได้เมื่อเหมาะสม" : "- ❌ ห้ามเสนอส่วนลดหรือราคาพิเศษใดๆ");
    // CS
    if (!on("cs_chat_24_7")) capRules.push("- ❌ บอทถูกปิดสำหรับช่วงนี้ ให้แจ้งลูกค้าว่าจะมีเจ้าหน้าที่ติดต่อกลับในเวลาทำการ");
    capRules.push(on("cs_order_check") ? "- ✅ ช่วยเช็คสถานะออเดอร์ได้" : "- ❌ ห้ามให้ข้อมูลสถานะออเดอร์ ให้โอนหาเจ้าหน้าที่");
    capRules.push(on("cs_tracking") ? "- ✅ ช่วยเช็ค Tracking พัสดุได้" : "- ❌ ห้ามให้ข้อมูล Tracking พัสดุ");
    capRules.push(on("cs_faq") ? "- ✅ ตอบ FAQ จาก KNOWLEDGE BASE ได้" : "- ❌ ห้ามตอบ FAQ ให้โอนหาเจ้าหน้าที่");
    capRules.push("- ✅ ตอบได้ทุกภาษาตามที่ลูกค้าใช้ (40+ ภาษา) — ดู LANGUAGE RULE ด้านบน");
    // Ops
    capRules.push(on("ops_stock") ? "- ✅ บอกสต็อกสินค้าได้" : "- ❌ ห้ามเปิดเผยจำนวนสต็อก");
    capRules.push(on("ops_process_order") ? "- ✅ สร้างออเดอร์ให้ลูกค้าได้ (ใช้ <<ORDER:...>> marker)" : "- ❌ ห้ามสร้างออเดอร์ ห้ามใส่ <<ORDER:...>> marker ไม่ว่ากรณีใด ให้บอกลูกค้าว่าเจ้าหน้าที่จะติดต่อกลับเพื่อยืนยัน");
    capRules.push(on("ops_warranty") ? "- ✅ ช่วยเรื่อง Warranty/Return ได้" : "- ❌ ห้ามรับเรื่อง Warranty/Return ให้โอนหาเจ้าหน้าที่");
    // Marketing
    capRules.push(on("mkt_promo") ? "- ✅ แจ้งโปรโมชั่นได้" : "- ❌ ห้ามแจ้งหรือเสนอโปรโมชั่น");
    capRules.push(on("mkt_cart_recovery") ? "- ✅ เตือนลูกค้าเรื่องสินค้าที่ค้างใน Cart ได้" : "- ❌ ห้ามทวงถามสินค้าใน Cart");

    const orderingEnabled = on("ops_process_order");

    const trainedOnlyRule = replyMode === "trained_only"
      ? `\n\nSTRICT TRAINED-ONLY MODE (สำคัญมาก):
- ตอบได้เฉพาะคำถามที่มีคำตอบใน KNOWLEDGE BASE หรือ LIVE PRODUCT CATALOG เท่านั้น
- ถ้าไม่มีข้อมูลที่ตรงคำถาม → ตอบเป็นข้อความว่างเปล่าทั้งหมด (empty string) เด็ดขาด ห้ามแต่ง ห้ามทักทาย ห้ามขอโทษ — ระบบจะส่งต่อให้คนรับเอง`
      : "";

    const systemPrompt = `[LANGUAGE RULE — HIGHEST PRIORITY, OVERRIDES EVERYTHING BELOW]
You MUST detect the language of the customer's LATEST message and respond ENTIRELY in that exact same language. This rule overrides every other instruction.
- If the customer writes in English → reply 100% in English. If Chinese → 100% Chinese. If Japanese → 100% Japanese. If Spanish, French, German, Korean, Vietnamese, Indonesian, Malay, Filipino, Hindi, Arabic, Portuguese, Russian, Italian, Turkish, Dutch, Polish, Swedish, Norwegian, Danish, Finnish, Czech, Greek, Hebrew, Bengali, Tamil, Urdu, Persian, Burmese, Khmer, Lao, Mongolian, Swahili, Ukrainian, Romanian, Hungarian, etc. → reply 100% in that language.
- Supports 40+ languages. NEVER mix Thai into a non-Thai reply. NEVER default to Thai if the customer wrote in another language.
- Only when the customer's language cannot be detected at all, fall back to ${localeName}.
- If the customer switches language mid-conversation, switch with them immediately.

You are an expert AI Sales & Customer Service agent for ${profile?.company_name || "this online store"}.
Your goals: greet warmly, answer product questions, RECOMMEND products from the live catalog based on the customer's intent and purchase history, close sales, handle warranty/returns, and escalate to human when needed.
Tone: friendly, helpful, concise.

LIVE PRODUCT CATALOG (ใช้ข้อมูลนี้ในการแนะนำ — อย่าแต่งราคา/สต็อก):
${catalogContext || "(no catalog available)"}

${purchaseHistory ? `PURCHASE HISTORY ของลูกค้าคนนี้ (${resolvedCustomerName}) — ใช้แนะนำสินค้าเสริม/อัพเกรด:\n${purchaseHistory}\n` : ""}
ENABLED CAPABILITIES (สำคัญมาก — ต้องปฏิบัติตามอย่างเคร่งครัด):
${capRules.join("\n")}

KNOWLEDGE BASE:
${trainingContext || "(no training documents yet)"}
${trainedOnlyRule}

PRODUCT IMAGES (สำคัญ):
- เมื่อแนะนำสินค้าที่มี IMG: url ใน catalog → แนบรูปด้วย markdown ทันที: ![ชื่อสินค้า](url)
- ใส่รูปไว้ก่อนรายละเอียดสินค้า ลูกค้าจะเห็นรูปในแชท

Rules:
- Keep replies under 4 short sentences when possible.
- เมื่อลูกค้าถามถึงสินค้า ให้แนะนำ 2-3 รายการจาก LIVE PRODUCT CATALOG พร้อมราคา (อย่าแต่งราคาเอง)
- ถ้ามี PURCHASE HISTORY ให้แนะนำสินค้าเสริม/อัพเกรดที่เข้ากันกับสิ่งที่เคยซื้อ
- Always end sales-intent replies with a clear next step (e.g. "ต้องการสั่งเลยไหมคะ?").
- Never invent prices, stock, or order numbers.

ORDER CONFIRMATION PROTOCOL (สำคัญมาก):
${orderingEnabled ? "" : "⚠️ ฟีเจอร์ Process Order ถูกปิด — ห้ามใช้ <<ORDER:...>> marker เด็ดขาด ให้บอกลูกค้าว่าเจ้าหน้าที่จะติดต่อกลับเพื่อยืนยันออเดอร์\n"}
- เมื่อลูกค้ายืนยันการสั่งซื้อชัดเจน (เช่น "สั่งเลย", "เอาอันนี้", "ยืนยัน", "order it", "I'll take it") ให้ตอบยืนยันสั้นๆ แล้วต่อท้ายด้วย marker นี้ (อย่าให้ลูกค้าเห็น เราจะลบทิ้งก่อนแสดงผล):
  <<ORDER:ชื่อสินค้าตรงตาม CATALOG|จำนวน>>
- ตัวอย่าง: "รับทราบค่ะ จัดส่ง iPhone 15 Pro 256GB ให้นะคะ <<ORDER:iPhone 15 Pro 256GB|1>>"
- ใส่ marker เฉพาะตอนที่ลูกค้ายืนยันแน่นอน ห้ามใส่ตอนแค่ถามข้อมูล`;

    // Save customer message if we have a conversation
    if (conversationId) {
      await admin.from("messages").insert({
        conversation_id: conversationId,
        user_id: ownerId,
        sender: "customer",
        content: userMessageContent,
      });
      // Detect human-takeover request
      const lower = userMessageContent.toLowerCase();
      const wantsHuman = /(คุยกับ(เจ้าหน้าที่|พนักงาน|แอดมิน|คน)|ขอ(เจ้าหน้าที่|แอดมิน|คน)|ติดต่อ(เจ้าหน้าที่|พนักงาน)|talk to (a )?(human|agent|staff|person)|speak to (a )?(human|agent))/i.test(lower);
      const convUpdate: any = { last_message: userMessageContent, last_message_at: new Date().toISOString() };
      if (wantsHuman) convUpdate.status = "human_takeover";
      await admin.from("conversations").update(convUpdate).eq("id", conversationId);
    } else if (body.saveToDb !== false && body.customerName) {
      // Create conversation (widget mode)
      const { data: conv } = await admin
        .from("conversations")
        .insert({
          user_id: ownerId,
          customer_name: body.customerName,
          channel: (body.channel as any) || "web_widget",
          last_message: userMessageContent,
        })
        .select()
        .single();
      if (conv) {
        conversationId = conv.id;
        await admin.from("messages").insert({
          conversation_id: conv.id,
          user_id: ownerId,
          sender: "customer",
          content: userMessageContent,
        });
      }
    }

    // Call Lovable AI
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...history,
          { role: "user", content: userMessageContent },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI gateway error", aiRes.status, errText);
      if (aiRes.status === 429) return json({ error: "Rate limit exceeded, please try again." }, 429);
      if (aiRes.status === 402) return json({ error: "AI credits exhausted. Please add funds in workspace settings." }, 402);
      return json({ error: "AI gateway error" }, 500);
    }

    const aiJson = await aiRes.json();
    const rawReply: string = aiJson.choices?.[0]?.message?.content?.trim() || "";

    // Trained-only mode: if AI returned empty (or only whitespace), stay silent.
    if (replyMode === "trained_only" && !rawReply) {
      return await silentlyStoreAndExit("trained_only_no_match");
    }
    if (!rawReply) {
      // No fallback bot message — stay silent so customer isn't told "bot can't reply".
      return await silentlyStoreAndExit("empty_ai_response");
    }

    // Parse <<ORDER:name|qty>> markers → decrement stock + create order
    let reply = rawReply;
    const orderRegex = /<<ORDER:([^|>]+)\|(\d+)>>/g;
    const orderMatches = [...rawReply.matchAll(orderRegex)];
    if (orderMatches.length && orderingEnabled) {
      reply = rawReply.replace(orderRegex, "").trim();
    } else if (orderMatches.length && !orderingEnabled) {
      // Strip markers entirely — feature is off, do not create orders
      reply = rawReply.replace(orderRegex, "").trim();
    }
    if (orderMatches.length && orderingEnabled) {
      for (const m of orderMatches) {
        const productName = m[1].trim();
        const qty = parseInt(m[2], 10) || 1;
        const { data: prod } = await admin
          .from("products")
          .select("id, name, price, stock")
          .eq("user_id", ownerId)
          .ilike("name", productName)
          .maybeSingle();
        if (prod && prod.stock >= qty) {
          await admin.from("products").update({ stock: prod.stock - qty }).eq("id", prod.id);
          await admin.from("orders").insert({
            user_id: ownerId,
            order_number: "#A-" + Math.floor(10000 + Math.random() * 90000),
            customer_name: resolvedCustomerName || body.customerName || "Customer",
            product_name: prod.name,
            amount: Number(prod.price) * qty,
            closed_by_ai: true,
            channel: (body.channel as any) || "web_widget",
          });
        } else if (prod) {
          reply += `\n\n(แจ้ง: สต็อก ${prod.name} ไม่พอค่ะ เหลือ ${prod.stock} ชิ้น)`;
        }
      }
    }

    // Save AI reply
    if (conversationId) {
      await admin.from("messages").insert({
        conversation_id: conversationId,
        user_id: ownerId,
        sender: "ai",
        content: reply,
      });
      await admin
        .from("conversations")
        .update({ last_message: reply, last_message_at: new Date().toISOString() })
        .eq("id", conversationId);
    }

    return json({ reply, conversationId });
  } catch (e) {
    console.error("chat-ai error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
