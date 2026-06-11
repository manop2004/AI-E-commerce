import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Send, Bot, User, Sparkles, Loader2, Mic, MicOff, ShoppingCart, X, Check, Plus, Minus } from "lucide-react";
import { useSpeechToText } from "@/hooks/use-speech-to-text";
import { ChatMessageContent } from "@/components/ChatMessageContent";

type Msg = { role: "user" | "assistant"; content: string };
type CartItem = { name: string; qty: number; price?: number };

export default function ChatWidget() {
  const { userId } = useParams();
  const [params] = useSearchParams();
  const customerName = params.get("name") || "Visitor";
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", content: "สวัสดีค่ะ ดิฉันเป็นผู้ช่วย AI พร้อมตอบทุกคำถามค่ะ มีอะไรให้ช่วยไหมคะ?" },
  ]);
  const [draft, setDraft] = useState("");
  const draftRef = useRef("");
  const [convId, setConvId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderDone, setOrderDone] = useState<null | { total: number; orderNumbers: string[]; trackingUrl?: string }>(null);
  const [form, setForm] = useState({ name: customerName === "Visitor" ? "" : customerName, phone: "", address: "", paymentMethod: "cod", notes: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, loading]);

  useEffect(() => {
    if (!convId) return;
    const ch = supabase
      .channel(`widget-messages-${convId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${convId}` }, (payload) => {
        const msg = payload.new as any;
        if (msg.sender === "ai" || msg.sender === "human") {
          setMsgs((prev) => prev.some((m) => m.content === msg.content) ? prev : [...prev, { role: "assistant", content: msg.content }]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [convId]);

  const applyCartActions = (actions?: { action: "add" | "remove"; name: string; qty: number }[]) => {
    if (!actions?.length) return;
    setCart((prev) => {
      const next = [...prev];
      for (const a of actions) {
        const idx = next.findIndex((c) => c.name.toLowerCase() === a.name.toLowerCase());
        if (a.action === "add") {
          if (idx >= 0) next[idx] = { ...next[idx], qty: next[idx].qty + a.qty };
          else next.push({ name: a.name, qty: a.qty });
        } else if (a.action === "remove" && idx >= 0) {
          next.splice(idx, 1);
        }
      }
      return next;
    });
  };

  const updateQty = (name: string, delta: number) => {
    setCart((prev) => prev.flatMap((c) => {
      if (c.name !== name) return [c];
      const q = c.qty + delta;
      return q <= 0 ? [] : [{ ...c, qty: q }];
    }));
  };

  const submitOrder = async () => {
    if (!userId || cart.length === 0) return;
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) return;
    setSubmitting(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/checkout`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          ownerId: userId,
          conversationId: convId,
          customerName: form.name,
          customerPhone: form.phone,
          shippingAddress: form.address,
          paymentMethod: form.paymentMethod,
          notes: form.notes,
          channel: "web_widget",
          items: cart,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setOrderDone({
          total: data.totalAmount || 0,
          orderNumbers: (data.orders || []).map((o: any) => o.order_number),
          trackingUrl: data.trackingUrl,
        });
        setCart([]);
        setCheckoutOpen(false);
        setMsgs((m) => [...m, { role: "assistant", content: `✅ ยืนยันออเดอร์เรียบร้อย! เลขที่: ${(data.orders || []).map((o: any) => o.order_number).join(", ")} ยอดรวม ฿${(data.totalAmount || 0).toLocaleString()}${data.trackingUrl ? `\nติดตามสถานะได้ที่: ${data.trackingUrl}` : ""}` }]);
      } else {
        const fail = (data.failures || []).join(", ");
        setMsgs((m) => [...m, { role: "assistant", content: `⚠️ สั่งซื้อไม่สำเร็จ: ${fail || data.error || "เกิดข้อผิดพลาด"}` }]);
      }
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: "⚠️ Connection error. Please try again." }]);
    } finally {
      setSubmitting(false);
    }
  };

  const send = async (overrideText?: string) => {
    const text = (overrideText || draftRef.current).trim();
    if (!text || !userId || loading) return;
    
    setDraft("");
    setMsgs((m) => [...m, { role: "user", content: text }]);
    setLoading(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-ai`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          ownerId: userId,
          customerName,
          channel: "web_widget",
          conversationId: convId,
          message: text,
          history: msgs,
        }),
      });
      const data = await res.json();
      if (data.conversationId) setConvId(data.conversationId);
      applyCartActions(data.cartActions);
      if (data.reply) {
        setMsgs((m) => [...m, { role: "assistant", content: data.reply }]);
      }
      else if (data.error) setMsgs((m) => [...m, { role: "assistant", content: `⚠️ ${data.error}` }]);
    } catch (e: any) {
      setMsgs((m) => [...m, { role: "assistant", content: "⚠️ Connection error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const { isListening, toggleListening, isSupported } = useSpeechToText({
    onResult: (text) => {
      setDraft((prev) => prev + text);
    },
    onEnd: () => {
      if (draftRef.current.trim()) {
        send();
      }
    },
  });

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground relative">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-card/40">
        <div className="h-9 w-9 rounded-lg bg-gradient-primary grid place-items-center shadow-glow">
          <Sparkles className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <div className="font-display font-semibold leading-none">AI Assistant</div>
          <div className="text-xs text-muted-foreground mt-0.5">Online · ตอบทันที 24/7</div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {msgs.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <div className="h-7 w-7 rounded-full bg-gradient-primary grid place-items-center shrink-0">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </div>
            )}
            <div
              className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm ${
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}
            >
              <ChatMessageContent content={m.content} />
            </div>
            {m.role === "user" && (
              <div className="h-7 w-7 rounded-full bg-muted grid place-items-center shrink-0">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2 justify-start">
            <div className="h-7 w-7 rounded-full bg-gradient-primary grid place-items-center">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="bg-muted px-3 py-2 rounded-2xl text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}
      </div>

      {cart.length > 0 && !checkoutOpen && (
        <div className="border-t border-border/50 bg-primary/5 px-4 py-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShoppingCart className="h-4 w-4 text-primary" />
            ตะกร้าสินค้า ({cart.reduce((s, c) => s + c.qty, 0)} ชิ้น)
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {cart.map((c) => (
              <div key={c.name} className="flex items-center justify-between text-xs bg-background rounded-lg px-2 py-1.5">
                <span className="truncate flex-1">{c.name}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => updateQty(c.name, -1)} className="h-6 w-6 grid place-items-center rounded bg-muted hover:bg-muted/70"><Minus className="h-3 w-3" /></button>
                  <span className="w-6 text-center">{c.qty}</span>
                  <button onClick={() => updateQty(c.name, 1)} className="h-6 w-6 grid place-items-center rounded bg-muted hover:bg-muted/70"><Plus className="h-3 w-3" /></button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => setCheckoutOpen(true)} className="w-full bg-gradient-primary text-primary-foreground rounded-xl py-2 text-sm font-semibold flex items-center justify-center gap-2">
            <Check className="h-4 w-4" /> ยืนยันสั่งซื้อ
          </button>
        </div>
      )}

      {checkoutOpen && (
        <div className="absolute inset-0 bg-background/95 backdrop-blur-sm z-50 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <div className="font-display font-semibold">กรอกที่อยู่จัดส่ง</div>
            <button onClick={() => setCheckoutOpen(false)} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-muted"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="bg-muted rounded-xl p-3 text-sm">
              <div className="font-semibold mb-2">สรุปรายการ</div>
              {cart.map((c) => (
                <div key={c.name} className="flex justify-between text-xs py-0.5">
                  <span>{c.name} × {c.qty}</span>
                </div>
              ))}
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">ชื่อผู้รับ *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-sm" placeholder="ชื่อ-นามสกุล" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">เบอร์โทร *</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-sm" placeholder="08x-xxx-xxxx" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">ที่อยู่จัดส่ง *</label>
              <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={3} className="w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-sm" placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">หมายเหตุ</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-sm" placeholder="ฝากร้านระบุเพิ่ม (ถ้ามี)" />
            </div>
          </div>
          <div className="border-t border-border/50 p-3">
            <button onClick={submitOrder} disabled={submitting || !form.name.trim() || !form.phone.trim() || !form.address.trim()} className="w-full bg-gradient-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              ยืนยันสั่งซื้อ
            </button>
          </div>
        </div>
      )}

      <div className="border-t border-border/50 p-3 bg-card/40">
        <div className="flex gap-2">
          {isSupported && (
            <button
              onClick={toggleListening}
              className={`h-10 w-10 grid place-items-center rounded-xl transition-colors ${
                isListening 
                  ? "bg-red-500 text-white animate-pulse" 
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              title={isListening ? "กำลังฟัง..." : "เริ่มพูด"}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          )}
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="พิมพ์ข้อความ..."
            className="flex-1 bg-background border border-border/50 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={() => send()}
            disabled={loading || !draft.trim()}
            className="h-10 w-10 grid place-items-center rounded-xl bg-gradient-primary text-primary-foreground disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <div className="text-[10px] text-muted-foreground text-center mt-2">Powered by AI Commerce Agent</div>
      </div>
    </div>
  );
}
