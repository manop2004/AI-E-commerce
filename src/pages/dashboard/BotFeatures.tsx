import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Headphones, Wrench, Megaphone, Lock, X } from "lucide-react";

const PLAN_ORDER: Record<string, number> = { free: 0, starter: 1, growth: 2, enterprise: 3 };

const GROUPS = {
  Sales: { icon: ShoppingBag, color: "primary", keys: ["sales_search", "sales_recommend", "sales_crosssell", "sales_bundle", "sales_dynamic_pricing"], labels: ["Search สินค้า", "Recommend สินค้า", "Cross-sell / Upsell", "Bundle Suggestion", "Dynamic Pricing"] },
  "Customer Service": { icon: Headphones, color: "secondary", keys: ["cs_chat_24_7", "cs_order_check", "cs_tracking", "cs_faq", "cs_multilang"], labels: ["ตอบแชท 24/7", "เช็คออเดอร์", "Tracking พัสดุ", "FAQ Auto Reply", "Multi-language"] },
  Operations: { icon: Wrench, color: "accent", keys: ["ops_stock", "ops_process_order", "ops_warranty", "ops_reorder", "ops_fraud"], labels: ["Check Stock", "Process Order", "Warranty Claim", "Auto Reorder", "Fraud Detection"] },
  Marketing: { icon: Megaphone, color: "primary", keys: ["mkt_segment", "mkt_promo", "mkt_cart_recovery", "mkt_churn", "mkt_ads_audience"], labels: ["Segment ลูกค้า", "Personalized Promo", "Cart Recovery", "Predict Churn", "Ads Audience AI"] },
};

export default function BotFeatures() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [platform, setPlatform] = useState<Record<string, { enabled: boolean; required_plan: string }>>({});
  const [userPlan, setUserPlan] = useState<string>("free");

  const load = async () => {
    if (!user) return;
    const [{ data: bf }, { data: pf }, { data: sub }] = await Promise.all([
      supabase.from("bot_features").select("*"),
      supabase.from("platform_features").select("*"),
      supabase.from("subscriptions").select("plan").eq("user_id", user.id).maybeSingle(),
    ]);
    const map: Record<string, boolean> = {};
    bf?.forEach((f) => { map[f.feature_key] = f.enabled; });
    setFeatures(map);
    const pmap: Record<string, { enabled: boolean; required_plan: string }> = {};
    pf?.forEach((f: any) => { pmap[f.feature_key] = { enabled: f.enabled, required_plan: f.required_plan }; });
    setPlatform(pmap);
    setUserPlan(sub?.plan || "free");
  };
  useEffect(() => {
    load();
    const ch = supabase.channel("platform_features").on("postgres_changes",
      { event: "*", schema: "public", table: "platform_features" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const toggle = async (key: string, val: boolean) => {
    if (!user) return;
    setFeatures((p) => ({ ...p, [key]: val }));
    await supabase.from("bot_features").update({ enabled: val }).eq("user_id", user.id).eq("feature_key", key as any);
  };

  const gateOf = (key: string) => {
    const p = platform[key];
    if (!p) return { ok: true, reason: "" };
    if (!p.enabled) return { ok: false, reason: "ปิดทั้งระบบโดยผู้ดูแล" };
    if ((PLAN_ORDER[userPlan] ?? 0) < (PLAN_ORDER[p.required_plan] ?? 0))
      return { ok: false, reason: `ต้องใช้แพ็ค ${p.required_plan}+` };
    return { ok: true, reason: "" };
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div><h1 className="font-display text-3xl font-bold">{t("dash.features")}</h1><p className="text-muted-foreground mt-1">เปิด/ปิดฟีเจอร์ AI Bot ตามต้องการ</p></div>
      <div className="grid md:grid-cols-2 gap-6">
        {Object.entries(GROUPS).map(([name, g]) => (
          <Card key={name} className="p-6 bg-gradient-card border-border/50">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-lg bg-gradient-primary grid place-items-center text-primary-foreground"><g.icon className="h-5 w-5" /></div>
              <h3 className="font-display font-bold text-xl">{name}</h3>
            </div>
            <div className="space-y-3">
              {g.keys.map((k, i) => {
                const gate = gateOf(k);
                return (
                  <div key={k} className={`flex items-center justify-between p-3 rounded-lg transition ${gate.ok ? "hover:bg-card/50" : "opacity-60"}`}>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium flex items-center gap-2">
                        {g.labels[i]}
                        {!gate.ok && <Lock className="h-3 w-3 text-muted-foreground" />}
                      </span>
                      {!gate.ok && <span className="text-xs text-muted-foreground">{gate.reason}</span>}
                    </div>
                    <Switch checked={gate.ok && (features[k] ?? true)} disabled={!gate.ok}
                      onCheckedChange={(v) => toggle(k, v)} />
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
