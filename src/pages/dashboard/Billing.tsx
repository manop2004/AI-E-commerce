import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Download } from "lucide-react";

type Plan = { key: string; name: string; price_monthly: number; features: string[]; highlight: boolean; is_active: boolean };

export default function Billing() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const nav = useNavigate();
  const [sub, setSub] = useState<any>(null);
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => setSub(data));
    supabase.from("plans").select("*").eq("is_active", true).order("sort_order").then(({ data }) => {
      setPlans(((data as any) || []).map((p: any) => ({ ...p, features: Array.isArray(p.features) ? p.features : [] })));
    });
  }, [user]);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight">{t("billing.title", "Billing & Plans")}</h1>
        <p className="text-muted-foreground mt-1">{t("billing.subtitle", "Manage your subscription and billing details.")}</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mt-8">
        {plans.map((p) => (
          <Card key={p.key} className={`p-6 bg-gradient-card border-border/50 relative ${sub?.plan === p.key ? "border-primary shadow-glow" : ""} ${p.highlight ? "border-primary/60" : ""}`}>
            <div className="font-display font-bold text-lg">{p.name}</div>
            <div className="font-display text-3xl font-bold my-3">
              {Number(p.price_monthly) === 0 ? (p.key === "enterprise" ? t("billing.customPrice", "Custom") : "฿0") : `฿${Number(p.price_monthly).toLocaleString()}`}
              {Number(p.price_monthly) > 0 && <span className="text-sm font-normal text-muted-foreground">{t("billing.perMonth", "/mo")}</span>}
            </div>
            <ul className="space-y-2 mb-4 text-sm">
              {p.features.map((f) => <li key={f} className="flex items-start gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />{f}</li>)}
            </ul>
            <Button
              variant={sub?.plan === p.key ? "outline" : "default"}
              disabled={sub?.plan === p.key}
              onClick={() => sub?.plan !== p.key && nav(`/dashboard/billing/checkout/${p.key}`)}
              className={`w-full ${sub?.plan !== p.key ? "bg-gradient-primary" : ""}`}
            >
              {sub?.plan === p.key ? t("billing.currentBtn", "Current") : t("billing.upgradeBtn", "Upgrade")}
            </Button>
          </Card>
        ))}
      </div>

      {sub && (
        <Card className="p-6 bg-gradient-card border-border/50 mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">{t("billing.currentPlan", "Current Plan")}</div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-display font-bold capitalize">{sub.plan}</span>
                <Badge variant={sub.status === "active" ? "default" : "secondary"}>
                  {sub.status === "active" ? t("billing.status.active", "Active") : sub.status}
                </Badge>
              </div>
              {sub.current_period_end && (
                <div className="text-sm text-muted-foreground mt-2">
                  {t("billing.renewsOn", "Renews on:")} {new Date(sub.current_period_end).toLocaleDateString()}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => nav("/dashboard/billing/invoices")}>
                <Download className="h-4 w-4 mr-2" /> {t("billing.invoices", "Invoices")}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}