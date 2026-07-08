import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ShoppingBag, Headphones, Wrench, Megaphone, Lock, LucideIcon } from "lucide-react";

// ✅ 1. เพิ่ม Type ให้แน่ใจว่าตัวแปรต่างๆ ส่งค่าถูกต้อง ไม่ติดแดง
type GroupDef = {
  icon: LucideIcon;
  color: string;
  keys: string[];
  labels: string[];
};

const PLAN_ORDER: Record<string, number> = { free: 0, starter: 1, growth: 2, enterprise: 3 };

const GROUPS: Record<string, GroupDef> = {
  Sales: { icon: ShoppingBag, color: "primary", keys: ["sales_search", "sales_recommend", "sales_crosssell", "sales_bundle", "sales_dynamic_pricing"], labels: ["features.sales.search", "features.sales.recommend", "features.sales.crosssell", "features.sales.bundle", "features.sales.dynamic"] },
  "Customer Service": { icon: Headphones, color: "secondary", keys: ["cs_chat_24_7", "cs_order_check", "cs_tracking", "cs_faq", "cs_multilang"], labels: ["features.cs.chat", "features.cs.order", "features.cs.tracking", "features.cs.faq", "features.cs.multilang"] },
  Operations: { icon: Wrench, color: "accent", keys: ["ops_stock", "ops_process_order", "ops_warranty", "ops_reorder", "ops_fraud"], labels: ["features.ops.stock", "features.ops.process", "features.ops.warranty", "features.ops.reorder", "features.ops.fraud"] },
  Marketing: { icon: Megaphone, color: "success", keys: ["mkt_broadcast", "mkt_recover", "mkt_coupon", "mkt_loyalty", "mkt_ab"], labels: ["features.mkt.broadcast", "features.mkt.recover", "features.mkt.coupon", "features.mkt.loyalty", "features.mkt.ab"] },
};

export default function BotFeatures() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [userPlan, setUserPlan] = useState<string>("free");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase.from("subscriptions").select("plan").eq("user_id", user.id).single();
      if (p) setUserPlan(p.plan || "free");
      
      const { data: f } = await supabase.from("bot_features").select("feature_key, enabled").eq("user_id", user.id);
      if (f) {
        const m: Record<string, boolean> = {};
        // ✅ 2. ระบุ Type (x: any) ป้องกัน TypeScript ฟ้อง object unknown
        f.forEach((x: any) => m[x.feature_key] = x.enabled);
        setFeatures(m);
      }
    })();
  }, [user]);

  const gateOf = (k: string) => {
    let req = "free";
    if (["sales_crosssell", "cs_tracking", "ops_warranty", "mkt_recover"].includes(k)) req = "starter";
    if (["sales_bundle", "cs_faq", "ops_reorder", "mkt_coupon"].includes(k)) req = "growth";
    if (["sales_dynamic_pricing", "cs_multilang", "ops_fraud", "mkt_loyalty", "mkt_ab"].includes(k)) req = "enterprise";

    // ✅ 3. ป้องกันค่าเป็น undefined เวลาเช็คตัวเลขแพ็กเกจ
    const currentPlanVal = PLAN_ORDER[userPlan] ?? 0;
    const reqPlanVal = PLAN_ORDER[req] ?? 0;

    if (currentPlanVal >= reqPlanVal) return { ok: true, reason: "" };
    return { ok: false, reason: t("features.requiresPlan", { plan: req }) };
  };

  const toggle = async (k: string, v: boolean) => {
    if (!user) return;
    setFeatures(p => ({ ...p, [k]: v }));
    // ✅ 4. ใส่ (as any) เพื่อป้องกัน Supabase Type ตีกันกับข้อมูลที่เราส่ง
    await supabase.from("bot_features").upsert({ user_id: user.id, feature_key: k, enabled: v } as any);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight">{t("features.pageTitle" as any)}</h1>
        <p className="text-muted-foreground">{t("features.pageDesc" as any)}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(GROUPS).map(([name, g]) => {
          const Icon = g.icon;
          return (
            <Card key={name} className="p-6 bg-gradient-card border-border/50">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 rounded-lg bg-gradient-primary grid place-items-center text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-display font-bold text-xl">{t(`features.groups.${name}` as any)}</h3>
              </div>
              <div className="space-y-3">
                {g.keys.map((k, i) => {
                  const gate = gateOf(k);
                  return (
                    <div key={k} className={`flex items-center justify-between p-3 rounded-lg transition ${gate.ok ? "hover:bg-card/50" : "opacity-60"}`}>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium flex items-center gap-2">
                          {t(g.labels[i] as any)}
                          {!gate.ok && <Lock className="h-3 w-3 text-muted-foreground" />}
                        </span>
                        {!gate.ok && <span className="text-xs text-muted-foreground">{gate.reason}</span>}
                      </div>
                      <Switch 
                        checked={gate.ok && (features[k] ?? true)} 
                        disabled={!gate.ok}
                        onCheckedChange={(v) => toggle(k, v)}
                      />
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}