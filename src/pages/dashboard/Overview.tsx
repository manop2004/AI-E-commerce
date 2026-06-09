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

const CHANNEL_LABEL: Record<string, string> = {
  line_oa: "LINE OA", messenger: "Messenger",
  instagram: "Instagram", web_widget: "เว็บไซต์", woocommerce: "WooCommerce", other: "อื่นๆ",
};

export default function Overview() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const [m, o] = await Promise.all([
      supabase.from("daily_metrics").select("*").order("metric_date", { ascending: true }).limit(30),
      supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(7),
    ]);
    setMetrics(m.data || []);
    setOrders(o.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const seed = async () => {
    if (!user) return;
    const { error } = await supabase.rpc("seed_demo_data_for", { uid: user.id });
    if (error) return toast.error(error.message);
    toast.success(t("dash.seeded"));
    load();
  };

  const today = metrics[metrics.length - 1] || { revenue: 0, ai_revenue: 0, chats_count: 0, orders_count: 0, conversion_rate: 0, new_customers: 0, returning_customers: 0 };
  const last7 = metrics.slice(-7).map((m) => ({
    day: new Date(m.metric_date).toLocaleDateString("th-TH", { weekday: "short" }),
    revenue: Number(m.revenue || 0),
  }));
  const channelTotals = orders.reduce((acc: Record<string, number>, o) => {
    const k = o.channel || "other"; acc[k] = (acc[k] || 0) + Number(o.amount); return acc;
  }, {});
  const channels = Object.entries(channelTotals).map(([k, v]) => ({ name: CHANNEL_LABEL[k] || k, value: v as number }))
    .sort((a, b) => b.value - a.value);
  const channelMax = channels.reduce((m, c) => Math.max(m, c.value), 0);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">{t("dash.welcome")}, {user?.email?.split("@")[0]} 👋</h1>
          <p className="text-muted-foreground mt-1">{new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
        {!loading && metrics.length === 0 && (
          <Button onClick={seed} className="bg-gradient-primary shadow-glow"><Sparkles className="h-4 w-4 mr-2" />{t("dash.seedDemo")}</Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI icon={<DollarSign />} label={t("dash.todayRevenue")} value={`฿${Number(today.revenue).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} trend="+12%" color="primary" />
        <KPI icon={<MessageSquare />} label={t("dash.todayChats")} value={today.chats_count} trend="+24%" color="secondary" />
        <KPI icon={<Target />} label={t("dash.conversion")} value={`${Number(today.conversion_rate).toFixed(1)}%`} trend="+3.2%" color="accent" />
        <KPI icon={<ShoppingCart />} label={t("dash.aiOrders")} value={today.orders_count} trend="+18%" color="primary" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6 bg-gradient-card border-border/50">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h3 className="font-display font-semibold text-lg">ยอดขาย 7 วันล่าสุด</h3>
              <p className="text-sm text-muted-foreground">รวมทุกช่องทาง (บาท)</p>
            </div>
            <Badge variant="outline" className="border-success/40 text-success">วันนี้: ฿{Number(today.revenue).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Badge>
          </div>
          {last7.length === 0 ? (
            <div className="h-[240px] grid place-items-center text-sm text-muted-foreground">ยังไม่มีข้อมูล</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={last7} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.25} vertical={false} />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => v >= 1000 ? `${Math.round(v/1000)}k` : v} />
                <Tooltip cursor={{ fill: "hsl(var(--muted))", opacity: 0.2 }} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v) => [`฿${Number(v).toLocaleString()}`, "ยอดขาย"]} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6 bg-gradient-card border-border/50">
          <h3 className="font-display font-semibold text-lg mb-1">ช่องทางที่ขายดี</h3>
          <p className="text-sm text-muted-foreground mb-4">จากออเดอร์ล่าสุด</p>
          {channels.length === 0 ? (
            <div className="h-[200px] grid place-items-center text-sm text-muted-foreground">ยังไม่มีข้อมูล</div>
          ) : (
            <div className="space-y-3">
              {channels.map((c) => (
                <div key={c.name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-muted-foreground">฿{c.value.toLocaleString()}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                    <div className="h-full bg-gradient-primary rounded-full" style={{ width: `${channelMax ? (c.value / channelMax) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 bg-gradient-card border-border/50">
          <h3 className="font-display font-semibold text-lg mb-4">{t("dash.recentOrders")}</h3>
          <div className="space-y-3">
            {orders.length === 0 && <p className="text-sm text-muted-foreground">No orders yet</p>}
            {orders.map((o) => (
              <div key={o.id} className="flex items-center gap-3 p-3 rounded-lg bg-card/50 border border-border/40">
                <div className="h-9 w-9 rounded-lg bg-primary/15 text-primary grid place-items-center"><Package className="h-4 w-4" /></div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{o.product_name}</div>
                  <div className="text-xs text-muted-foreground">{o.customer_name} · {o.order_number}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">฿{Number(o.amount).toLocaleString()}</div>
                  {o.closed_by_ai && <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">AI</Badge>}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 bg-gradient-card border-border/50">
          <h3 className="font-display font-semibold text-lg mb-4">Customers</h3>
          <div className="grid grid-cols-2 gap-4">
            <MiniStat icon={<UserPlus className="h-4 w-4" />} label={t("dash.newCustomers")} value={today.new_customers} />
            <MiniStat icon={<RotateCcw className="h-4 w-4" />} label={t("dash.returning")} value={today.returning_customers} />
          </div>
          <div className="mt-6">
            <h4 className="text-sm font-semibold mb-3">{t("dash.topProduct")}</h4>
            <div className="p-4 rounded-lg bg-gradient-primary/10 border border-primary/30">
              <div className="font-medium">iPhone 15 Pro 256GB</div>
              <div className="text-sm text-muted-foreground mt-1">42 orders this week · ฿1,801,800</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

const KPI = ({ icon, label, value, trend, color }: { icon: React.ReactNode; label: string; value: any; trend: string; color: string }) => (
  <Card className="p-5 bg-gradient-card border-border/50 hover:border-primary/40 transition-colors">
    <div className="flex items-center justify-between mb-3">
      <div className={`h-9 w-9 rounded-lg bg-${color}/15 text-${color} grid place-items-center`}>{icon}</div>
      <Badge variant="outline" className="border-success/40 text-success text-[10px]"><TrendingUp className="h-3 w-3 mr-1" />{trend}</Badge>
    </div>
    <div className="font-display text-2xl font-bold">{value}</div>
    <div className="text-xs text-muted-foreground mt-1">{label}</div>
  </Card>
);

const MiniStat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) => (
  <div className="p-4 rounded-lg bg-card/50 border border-border/40">
    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">{icon}{label}</div>
    <div className="font-display text-2xl font-bold">{value}</div>
  </div>
);
