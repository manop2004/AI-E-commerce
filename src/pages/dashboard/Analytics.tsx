import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, CartesianGrid } from "recharts";
import { Bot, MessageSquare, ShoppingBag, TrendingUp } from "lucide-react";

export default function Analytics() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("daily_metrics").select("*").order("metric_date").then(({ data }) => setMetrics(data || []));
  }, [user]);

  const recent = metrics.slice(-7).map((m) => ({
    ...m,
    day: new Date(m.metric_date).toLocaleDateString(
      i18n.language === "en" ? "en-US" : i18n.language === "zh" ? "zh-CN" : "th-TH",
      { day: "numeric", month: "short" }
    ),
  }));
  const totalChats = metrics.reduce((sum, m) => sum + Number(m.chats_count || 0), 0);
  const totalOrders = metrics.reduce((sum, m) => sum + Number(m.orders_count || 0), 0);
  const totalRevenue = metrics.reduce((sum, m) => sum + Number(m.ai_revenue || 0), 0);
  const avgConversion = metrics.length ? metrics.reduce((sum, m) => sum + Number(m.conversion_rate || 0), 0) / metrics.length : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">{t("dash.analytics")}</h1>
        <p className="text-muted-foreground mt-1">{t("analytics.subtitle", "ดูผลลัพธ์แบบง่าย: ลูกค้าคุยเท่าไหร่ บอทช่วยขายได้แค่ไหน")}</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={MessageSquare} label={t("analytics.totalChats", "แชททั้งหมด")} value={totalChats.toLocaleString()} hint={t("analytics.totalChatsHint", "จำนวนครั้งที่ลูกค้าคุย")} />
        <MetricCard icon={Bot} label={t("analytics.aiRevenue", "ยอดขายจาก AI")} value={`฿${totalRevenue.toLocaleString()}`} hint={t("analytics.aiRevenueHint", "บอทช่วยปิดการขาย")} />
        <MetricCard icon={ShoppingBag} label={t("analytics.orders", "ออเดอร์")} value={totalOrders.toLocaleString()} hint={t("analytics.ordersHint", "คำสั่งซื้อที่เกิดขึ้น")} />
        <MetricCard icon={TrendingUp} label={t("analytics.conversionRate", "อัตราปิดการขาย")} value={`${avgConversion.toFixed(1)}%`} hint={t("analytics.conversionRateHint", "เฉลี่ยจากข้อมูลทั้งหมด")} />
      </div>

      <ChartCard title={t("analytics.chartTitle", "ยอดขายจาก AI 7 วันล่าสุด")}>
        {recent.length === 0 ? (
          <div className="h-[240px] grid place-items-center text-sm text-muted-foreground">{t("analytics.noData", "ยังไม่มีข้อมูลวิเคราะห์")}</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={recent}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.25} vertical={false} />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v) => [`฿${Number(v).toLocaleString()}`, t("analytics.aiRevenue", "ยอดขายจาก AI")]} />
              <Bar dataKey="ai_revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <Card className="p-5 bg-gradient-card border-border/50">
        <div className="font-display font-semibold mb-2">{t("analytics.quickInsightTitle", "อ่านผลแบบเร็ว")}</div>
        <p className="text-sm text-muted-foreground">
          {t("analytics.quickInsightDesc", "ถ้า “แชทเยอะ แต่ออเดอร์น้อย” ให้เพิ่มข้อมูลสินค้า/FAQ ในหน้าสอนบอท และเปิดหน้า Voice AI เพื่อดูว่าสินค้าไหนถูกถามบ่อย")}
        </p>
      </Card>
    </div>
  );
}

const MetricCard = ({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint: string }) => (
  <Card className="p-5 bg-gradient-card border-border/50">
    <Icon className="h-5 w-5 text-primary mb-3" />
    <div className="text-sm text-muted-foreground">{label}</div>
    <div className="font-display text-2xl font-bold mt-1">{value}</div>
    <div className="text-xs text-muted-foreground mt-1">{hint}</div>
  </Card>
);

const ChartCard = ({ title, children }: { title: string; children: React.ReactElement }) => (
  <Card className="p-6 bg-gradient-card border-border/50">
    <h3 className="font-display font-semibold mb-4">{title}</h3>
    {children}
  </Card>
);