import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, MessageSquare, Target, ShoppingCart, DollarSign, Package, UserPlus, RotateCcw, Sparkles
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export default function Overview() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0];

  const getChannelLabel = (channel: string) => {
    switch (channel) {
      case "web_widget": return t("dash.webWidget", "Website");
      case "other": return t("dash.other", "Other");
      case "line_oa": return "LINE OA";
      case "messenger": return "Messenger";
      case "instagram": return "Instagram";
      case "woocommerce": return "WooCommerce";
      default: return channel;
    }
  };

  const load = async () => {
    if (!user?.id) return;
    try {
      const [m, o] = await Promise.all([
        supabase.from("daily_metrics").select("*").order("metric_date", { ascending: true }).limit(30),
        supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(7),
      ]);
      
      // 🚀 เพิ่มเงื่อนไขป้องกันการเซ็ตทับด้วยค่าว่างหากตัวแปรส่งมาไม่สมบูรณ์ตอนสลับหน้าจอ
      if (m.data) setMetrics(m.data);
      if (o.data) setOrders(o.data);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  // 🚀 เพิ่ม i18n.language เข้ามาเพื่อให้ระบบดึงข้อมูลใหม่อย่างมั่นคงทุกครั้งที่มีการเปลี่ยนภาษา
  useEffect(() => {
    if (user?.id) {
      load();
    }
  }, [user?.id, i18n.language]);

  const seed = async () => {
    if (!user) return;
    const { error } = await supabase.rpc("seed_demo_data_for", { uid: user.id });
    if (error) return toast.error(error.message);
    toast.success(t("dash.seeded", "Demo data loaded successfully!"));
    load();
  };

  const today = metrics[metrics.length - 1] || {
    revenue: 0, ai_revenue: 0, chats_count: 0, orders_count: 0,
    conversion_rate: 0, new_customers: 0, returning_customers: 0
  };

  // 🚀 เปลี่ยนมาแมปปิ้งวันในสัปดาห์ด้วย Array ชุดนี้โดยตรง เพื่อแก้ปัญหาภาษาไทยไม่ทำงานบนเบราว์เซอร์บางเวอร์ชัน
  const last7 = metrics.slice(-7).map((m) => {
    const date = new Date(m.metric_date);
    const dayIndex = date.getDay(); // 0 = วันอาทิตย์, 1 = วันจันทร์...
    const daysTh = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
    const daysEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const isTh = i18n.language?.startsWith("th");

    return {
      day: isTh ? daysTh[dayIndex] : daysEn[dayIndex],
      revenue: m.revenue
    };
  });

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">{t("dash.overview")}</h1>
          <p className="text-muted-foreground mt-1">{t("dash.welcome")}, {displayName}</p>
        </div>
        {metrics.length === 0 && (
          <Button onClick={seed} variant="outline" className="gap-2 border-primary/30 hover:bg-primary/5">
            <Sparkles className="h-4 w-4 text-primary animate-pulse" />
            {t("dash.seedDemo")}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI icon={<DollarSign />} label={t("dash.todayRevenue")} value={`฿${today.revenue.toLocaleString()}`} trend="+12.4%" color="primary" />
        <KPI icon={<MessageSquare />} label={t("dash.todayChats")} value={today.chats_count} trend="+24.1%" color="secondary" />
        <KPI icon={<Target />} label={t("dash.conversion")} value={`${Number(today.conversion_rate).toFixed(1)}%`} trend="+3.2%" color="accent" />
        <KPI icon={<ShoppingCart />} label={t("dash.aiOrders")} value={today.orders_count} trend="+18.5%" color="primary" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6 bg-gradient-card border-border/50">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h3 className="font-display font-semibold text-lg">{t("dash.revenueTrend")}</h3>
            </div>
          </div>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={last7}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} tickFormatter={(v) => `฿${v}`} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-card border-border/50 flex flex-col justify-between">
          <div>
            <h3 className="font-display font-semibold text-lg mb-6">{t("dash.channelBreakdown")}</h3>
            <div className="space-y-6">
              <MiniStat icon={<UserPlus />} label={t("dash.newCustomers")} value={today.new_customers} />
              <MiniStat icon={<RotateCcw />} label={t("dash.returning")} value={today.returning_customers} />
              <MiniStat icon={<Package />} label={t("dash.aiRevenue")} value={`฿${today.ai_revenue.toLocaleString()}`} />
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-border/50">
            <h4 className="text-sm font-semibold mb-3">{t("dash.topProduct")}</h4>
            <div className="p-4 rounded-lg bg-gradient-primary/10 border border-primary/30">
              <div className="font-medium">iPhone 15 Pro 256GB</div>
              <div className="text-sm text-muted-foreground mt-1">42 orders this week · ฿1,801,800</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6 bg-gradient-card border-border/50">
          <h3 className="font-display font-semibold text-lg mb-4">{t("dash.recentOrders")}</h3>
          <div className="divide-y divide-border/50">
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">{t("dash.noOrders", "No recent orders")}</p>
            ) : (
              orders.map((o) => (
                <div key={o.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <div className="font-medium">฿{o.total_amount?.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {getChannelLabel(o.channel)} · {o.customer_name || "Customer"}
                    </div>
                  </div>
                  <Badge variant={o.status === "completed" ? "default" : "secondary"}>
                    {o.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-6 bg-gradient-card border-border/50">
          <h3 className="font-display font-semibold text-lg mb-4">{t("dash.recentChats")}</h3>
          <p className="text-sm text-muted-foreground py-4">{t("dash.noChats", "No recent active chats")}</p>
        </Card>
      </div>
    </div>
  );
}

const KPI = ({ icon, label, value, trend, color }: { icon: React.ReactNode; label: string; value: any; trend: string; color: string }) => (
  <Card className="p-5 bg-gradient-card border-border/50 hover:border-primary/40 transition-colors group">
    <div className="flex items-center justify-between mb-3">
      <div className={`h-9 w-9 rounded-lg bg-${color}/15 text-${color} grid place-items-center group-hover:scale-105 transition-transform`}>
        {icon}
      </div>
      <Badge variant="outline" className="border-success/40 text-success text-[10px] bg-success/5 font-medium">
        <TrendingUp className="h-3 w-3 mr-1" />
        {trend}
      </Badge>
    </div>
    <div className="font-display text-2xl font-bold tracking-tight">{value}</div>
    <div className="text-xs text-muted-foreground mt-1.5 font-medium">{label}</div>
  </Card>
);

const MiniStat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className="text-muted-foreground h-4 w-4">{icon}</div>
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
    </div>
    <div className="font-display font-bold">{value}</div>
  </div>
);