import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Plug, GraduationCap, ToggleRight, Code2, Rocket, Sparkles } from "lucide-react";

type Step = {
  id: "connect" | "train" | "features" | "embed" | "test";
  icon: any;
  href: string;
  done: boolean;
};

export default function GettingStarted() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: integ }, { data: docs }, { data: feats }, { data: orders }] = await Promise.all([
        supabase.from("integrations").select("status").eq("status", "connected").limit(1),
        supabase.from("training_documents").select("id").limit(1),
        supabase.from("bot_features").select("enabled").eq("enabled", true).limit(1),
        supabase.from("orders").select("id").limit(1),
      ]);

      setSteps([
        {
          id: "connect",
          icon: Plug,
          href: "/dashboard/integrations",
          done: !!integ?.length,
        },
        {
          id: "train",
          icon: GraduationCap,
          href: "/dashboard/training",
          done: !!docs?.length,
        },
        {
          id: "features",
          icon: ToggleRight,
          href: "/dashboard/features",
          done: !!feats?.length,
        },
        {
          id: "embed",
          icon: Code2,
          href: "/dashboard/integrations#widget",
          done: false,
        },
        {
          id: "test",
          icon: Rocket,
          href: "/dashboard/livechat",
          done: !!orders?.length,
        },
      ]);
      setLoading(false);
    })();
  }, [user]);

  const completed = steps.filter((s) => s.done).length;
  const pct = steps.length ? Math.round((completed / steps.length) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-3">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs text-primary font-medium">{t("dash.onboarding.badge")}</span>
        </div>
        <h1 className="font-display text-3xl font-bold">{t("dash.onboarding.mainTitle")}</h1>
        <p className="text-muted-foreground mt-1">{t("dash.onboarding.mainSubtitle")}</p>
      </div>

      <Card className="p-6 bg-gradient-card border-border/50">
        <div className="flex items-center justify-between mb-3">
          <div className="font-display font-semibold">{t("dash.onboarding.progress")}</div>
          <div className="text-sm text-muted-foreground">{completed}/{steps.length} {t("dash.onboarding.completed")}</div>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-gradient-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </Card>

      <div className="grid gap-4">
        {loading ? (
          <Card className="p-12 text-center text-muted-foreground">{t("common.loading")}</Card>
        ) : (
          steps.map((s) => (
            <Card key={s.id} className={`p-6 bg-gradient-card border-border/50 flex items-start gap-4 ${s.done ? "border-success/40" : ""}`}>
              <div className={`h-12 w-12 rounded-xl grid place-items-center shrink-0 ${s.done ? "bg-success/15 text-success" : "bg-primary/15 text-primary"}`}>
                {s.done ? <Check className="h-6 w-6" /> : <s.icon className="h-6 w-6" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display font-semibold">{t(`dash.onboarding.steps.${s.id}.title`)}</div>
                <div className="text-sm text-muted-foreground mt-1">{t(`dash.onboarding.steps.${s.id}.desc`)}</div>
              </div>
              <Link to={s.href}>
                <Button variant={s.done ? "outline" : "default"} className={s.done ? "" : "bg-gradient-primary"}>
                  {s.done ? t("dash.onboarding.edit") : t(`dash.onboarding.steps.${s.id}.cta`)}
                </Button>
              </Link>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}