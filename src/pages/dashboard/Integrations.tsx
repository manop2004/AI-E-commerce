import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Code2, Copy, ExternalLink, Settings, Bot, UserCog, BookOpen } from "lucide-react";
import { ChannelSetupDialog } from "@/components/ChannelSetupDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PROVIDERS = [
  { key: "woocommerce", name: "WooCommerce", color: "from-purple-500/20" },
  { key: "line_oa", name: "LINE OA", color: "from-green-500/20" },
  { key: "messenger", name: "Facebook Messenger", color: "from-blue-500/20" },
  { key: "instagram", name: "Instagram DM", color: "from-pink-500/20" },
  { key: "web_widget", name: "Website Chat Widget", color: "from-cyan-500/20" },
] as const;

const REPLY_MODES = [
  { value: "auto", label: "บอทตอบอัตโนมัติ", icon: Bot, hint: "บอทตอบทุกข้อความตามที่สอนไว้" },
  { value: "trained_only", label: "ตอบเฉพาะที่สอนไว้", icon: BookOpen, hint: "ถ้าไม่รู้คำตอบ → เงียบ ให้คนรับช่วง" },
  { value: "human_only", label: "คนตอบเท่านั้น", icon: UserCog, hint: "บอทไม่ตอบเลย เก็บข้อความให้แอดมิน" },
] as const;

export default function Integrations() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [list, setList] = useState<any[]>([]);
  const [setupProvider, setSetupProvider] = useState<"line_oa" | "messenger" | "instagram" | "woocommerce" | null>(null);

  const SETUP_KEYS = new Set(["line_oa", "messenger", "instagram", "woocommerce"]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("integrations").select("*");
    setList(data || []);
  };
  useEffect(() => { load(); }, [user]);

  const toggle = async (key: string, currentlyConnected: boolean) => {
    if (!user) return;
    if (currentlyConnected) {
      await supabase.from("integrations").update({ status: "disconnected", connected_at: null }).eq("user_id", user.id).eq("provider", key as any);
      toast.success("Disconnected");
    } else {
      await supabase.from("integrations").upsert({ user_id: user.id, provider: key as any, status: "connected", store_name: `${key}-store`, connected_at: new Date().toISOString() }, { onConflict: "user_id,provider" });
      toast.success("Connected!");
    }
    load();
  };

  const updateReplyMode = async (key: string, mode: string) => {
    if (!user) return;
    setList((prev) => prev.map((i) => (i.provider === key ? { ...i, reply_mode: mode } : i)));
    const { error } = await supabase
      .from("integrations")
      .upsert({ user_id: user.id, provider: key as any, reply_mode: mode } as any, { onConflict: "user_id,provider" });
    if (error) {
      toast.error("บันทึกโหมดบอทไม่สำเร็จ");
      load();
    } else {
      toast.success("อัปเดตโหมดบอทแล้ว");
    }
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const embedSnippet = user
    ? `<script src="${origin}/widget.js" data-bot="${user.id}" defer></script>`
    : "";
  const widgetUrl = user ? `${origin}/widget/${user.id}` : "";

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied!");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">{t("dash.integrations")}</h1>
        <p className="text-muted-foreground mt-1">เชื่อมต่อร้านค้าและช่องทางการขายของคุณ</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PROVIDERS.map((p) => {
          const item = list.find((i) => i.provider === p.key);
          const connected = item?.status === "connected";
          return (
            <Card key={p.key} className={`relative overflow-hidden p-6 bg-gradient-card border-border/50 ${connected ? "border-primary/50 shadow-glow" : ""}`}>
              <div className={`absolute inset-0 bg-gradient-to-br ${p.color} to-transparent opacity-50`} />
              <div className="relative">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="font-display font-semibold text-lg">{p.name}</div>
                    {item?.store_name && <div className="text-xs text-muted-foreground mt-0.5">{item.store_name}</div>}
                  </div>
                  {connected && <Badge variant="outline" className="border-success/40 text-success"><Check className="h-3 w-3 mr-1" />{t("dash.connected")}</Badge>}
                </div>
                {SETUP_KEYS.has(p.key) ? (
                  <div className="flex gap-2">
                    <Button onClick={() => setSetupProvider(p.key as any)} variant={connected ? "outline" : "default"} className={`flex-1 ${!connected ? "bg-gradient-primary" : ""}`}>
                      <Settings className="h-4 w-4" /> {connected ? "แก้ไข" : "ตั้งค่า"}
                    </Button>
                    {connected && (
                      <Button onClick={() => toggle(p.key, true)} variant="ghost" size="sm">×</Button>
                    )}
                  </div>
                ) : (
                  <Button onClick={() => toggle(p.key, connected)} variant={connected ? "outline" : "default"} className={`w-full ${!connected ? "bg-gradient-primary" : ""}`}>
                    {connected ? t("dash.disconnect") : t("dash.connect")}
                  </Button>
                )}
                {connected && (
                  <div className="mt-3 pt-3 border-t border-border/40">
                    <div className="text-[11px] text-muted-foreground mb-1.5 font-medium">โหมดการตอบของบอท</div>
                    <Select value={item?.reply_mode || "auto"} onValueChange={(v) => updateReplyMode(p.key, v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {REPLY_MODES.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            <div className="flex items-center gap-2">
                              <m.icon className="h-3.5 w-3.5" />
                              <span>{m.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {REPLY_MODES.find((m) => m.value === (item?.reply_mode || "auto"))?.hint}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Web widget embed */}
      <Card id="widget" className="p-6 bg-gradient-card border-border/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-gradient-primary grid place-items-center shadow-glow">
            <Code2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-display font-semibold text-lg">Web Chat Widget</div>
            <div className="text-xs text-muted-foreground">วาง snippet นี้ก่อนปิด &lt;/body&gt; บนเว็บไซต์ของคุณ — ปุ่มแชทจะโผล่มุมขวาล่างทันที</div>
          </div>
        </div>

        <div className="bg-background/60 border border-border/50 rounded-lg p-4 font-mono text-xs overflow-x-auto">
          {embedSnippet || "loading..."}
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          <Button size="sm" onClick={() => copy(embedSnippet)} disabled={!embedSnippet}>
            <Copy className="h-4 w-4" /> Copy snippet
          </Button>
          <a href={widgetUrl} target="_blank" rel="noreferrer">
            <Button size="sm" variant="outline" disabled={!widgetUrl}>
              <ExternalLink className="h-4 w-4" /> Preview widget
            </Button>
          </a>
        </div>

        <div className="mt-4 rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground">
          <div className="font-semibold text-foreground mb-1">✅ ใช้ได้จริง — ทดสอบยังไง?</div>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>กด <span className="font-semibold">Preview widget</span> เพื่อดูหน้าตาแชทก่อน</li>
            <li>คัดลอก snippet ไปวางในไฟล์ HTML / theme ของเว็บคุณ (ก่อน <code className="bg-muted px-1 rounded">&lt;/body&gt;</code>)</li>
            <li>เปิดเว็บคุณ — จะเห็นปุ่มแชทกลมๆ มุมขวาล่างทันที กดเปิดได้</li>
            <li>ทุกข้อความที่ลูกค้าส่งมาจะมาโผล่ที่หน้า Live Chat ของ Dashboard</li>
          </ol>
        </div>
      </Card>

      <ChannelSetupDialog
        open={!!setupProvider}
        onOpenChange={(v) => !v && setSetupProvider(null)}
        provider={setupProvider}
        onSaved={load}
      />
    </div>
  );
}
