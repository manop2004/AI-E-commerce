import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PackageCheck, Search, Truck, Loader2, MessageSquare, ExternalLink, Copy } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const STATUS_OPTIONS = [
  { value: "pending", label: "รอยืนยัน", tone: "border-warning/40 text-warning" },
  { value: "paid", label: "ชำระเงินแล้ว", tone: "border-primary/40 text-primary" },
  { value: "preparing", label: "กำลังจัดเตรียม", tone: "border-primary/40 text-primary" },
  { value: "packed", label: "แพ็กแล้ว", tone: "border-primary/40 text-primary" },
  { value: "shipped", label: "ส่งแล้ว", tone: "border-success/40 text-success" },
  { value: "delivered", label: "สำเร็จ", tone: "border-success/40 text-success" },
  { value: "cancelled", label: "ยกเลิก", tone: "border-destructive/40 text-destructive" },
];

const PAYMENT_OPTIONS = [
  { value: "unpaid", label: "ยังไม่ชำระ" },
  { value: "pending", label: "รอตรวจสอบ" },
  { value: "paid", label: "ชำระแล้ว" },
  { value: "refunded", label: "คืนเงินแล้ว" },
];

type Order = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string | null;
  shipping_address: string | null;
  product_name: string;
  quantity: number;
  amount: number;
  channel: string | null;
  status: string;
  fulfillment_status: string;
  payment_method: string;
  payment_status: string;
  tracking_number: string | null;
  tracking_url: string | null;
  conversation_id: string | null;
  created_at: string;
  status_updated_at: string;
  notes: string | null;
};

function statusMeta(status?: string) {
  return STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];
}

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Order | null>(null);
  const [form, setForm] = useState({ fulfillment_status: "pending", payment_status: "unpaid", tracking_number: "", tracking_url: "" });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) toast.error(error.message);
    setOrders((data as Order[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel("orders-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter((o) => [o.order_number, o.customer_name, o.customer_phone, o.product_name, o.tracking_number]
      .some((v) => String(v || "").toLowerCase().includes(term)));
  }, [orders, q]);

  const openOrder = (order: Order) => {
    setActive(order);
    setForm({
      fulfillment_status: order.fulfillment_status || order.status || "pending",
      payment_status: order.payment_status || "unpaid",
      tracking_number: order.tracking_number || "",
      tracking_url: order.tracking_url || "",
    });
  };

  const saveStatus = async () => {
    if (!active) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("order-status", {
        body: { orderId: active.id, ...form },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data?.externalSent ? "อัปเดตแล้ว และส่งเข้าช่องทางลูกค้าแล้ว" : "อัปเดตแล้ว และเพิ่มข้อความเข้าแชทแล้ว");
      setActive(null);
      await load();
    } catch (e: any) {
      toast.error(e.message || "อัปเดตสถานะไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const trackingLink = (order: Order) => `${window.location.origin}/track/${order.user_id}?order=${encodeURIComponent(order.order_number)}&phone=${encodeURIComponent(order.customer_phone || "")}`;

  const copyTracking = async (order: Order) => {
    await navigator.clipboard.writeText(trackingLink(order));
    toast.success("คัดลอกลิงก์ติดตามแล้ว");
  };

  const totals = useMemo(() => ({
    count: orders.length,
    pending: orders.filter((o) => ["pending", "paid", "preparing", "packed"].includes(o.fulfillment_status)).length,
    shipped: orders.filter((o) => o.fulfillment_status === "shipped").length,
    revenue: orders.reduce((s, o) => s + Number(o.amount || 0), 0),
  }), [orders]);

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold flex items-center gap-2"><PackageCheck className="h-7 w-7" />คำสั่งซื้อ</h1>
          <p className="text-sm text-muted-foreground">ดูออเดอร์ลูกค้า อัปเดตสถานะ และส่งสถานะกลับเข้าแชทอัตโนมัติ</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4 bg-gradient-card border-border/50"><div className="text-xs text-muted-foreground">ออเดอร์ทั้งหมด</div><div className="text-2xl font-bold">{totals.count}</div></Card>
        <Card className="p-4 bg-gradient-card border-border/50"><div className="text-xs text-muted-foreground">กำลังดำเนินการ</div><div className="text-2xl font-bold">{totals.pending}</div></Card>
        <Card className="p-4 bg-gradient-card border-border/50"><div className="text-xs text-muted-foreground">ส่งแล้ว</div><div className="text-2xl font-bold">{totals.shipped}</div></Card>
        <Card className="p-4 bg-gradient-card border-border/50"><div className="text-xs text-muted-foreground">ยอดรวม</div><div className="text-2xl font-bold">฿{totals.revenue.toLocaleString()}</div></Card>
      </div>

      <Card className="p-3 bg-gradient-card border-border/50">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาเลขออเดอร์ ลูกค้า เบอร์โทร สินค้า หรือเลขพัสดุ..." className="pl-9" />
        </div>
      </Card>

      <Card className="bg-gradient-card border-border/50 overflow-hidden">
        {loading ? (
          <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-sm text-muted-foreground">ยังไม่มีคำสั่งซื้อ</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ออเดอร์</TableHead>
                <TableHead>ลูกค้า</TableHead>
                <TableHead>สินค้า</TableHead>
                <TableHead>ยอด</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>ช่องทาง</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((order) => {
                const meta = statusMeta(order.fulfillment_status || order.status);
                return (
                  <TableRow key={order.id}>
                    <TableCell>
                      <div className="font-semibold">{order.order_number}</div>
                      <div className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{order.customer_name}</div>
                      <div className="text-xs text-muted-foreground">{order.customer_phone || "-"}</div>
                    </TableCell>
                    <TableCell className="max-w-[240px]"><div className="truncate">{order.product_name}</div><div className="text-xs text-muted-foreground">× {order.quantity}</div></TableCell>
                    <TableCell>฿{Number(order.amount).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="outline" className={meta.tone}>{meta.label}</Badge></TableCell>
                    <TableCell className="uppercase text-xs text-muted-foreground">{order.channel || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {order.conversation_id && <Button asChild size="sm" variant="ghost"><Link to="/dashboard/livechat"><MessageSquare className="h-4 w-4" /></Link></Button>}
                        <Button size="sm" variant="outline" onClick={() => openOrder(order)}><Truck className="h-4 w-4" />อัปเดต</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={!!active} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>จัดการคำสั่งซื้อ {active?.order_number}</DialogTitle></DialogHeader>
          {active && (
            <div className="space-y-5 py-2">
              <div className="grid md:grid-cols-2 gap-3 text-sm">
                <Card className="p-3 bg-card/50 border-border/40"><div className="text-xs text-muted-foreground">ลูกค้า</div><div className="font-semibold">{active.customer_name}</div><div>{active.customer_phone || "-"}</div></Card>
                <Card className="p-3 bg-card/50 border-border/40"><div className="text-xs text-muted-foreground">สินค้า</div><div className="font-semibold">{active.product_name} × {active.quantity}</div><div>฿{Number(active.amount).toLocaleString()}</div></Card>
              </div>
              <div className="rounded-lg border border-border/40 p-3 text-sm whitespace-pre-wrap"><div className="text-xs text-muted-foreground mb-1">ที่อยู่จัดส่ง</div>{active.shipping_address || "-"}</div>
              {active.notes && <div className="rounded-lg border border-border/40 p-3 text-sm"><div className="text-xs text-muted-foreground mb-1">หมายเหตุ</div>{active.notes}</div>}

              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>สถานะสินค้า</Label>
                  <Select value={form.fulfillment_status} onValueChange={(v) => setForm((f) => ({ ...f, fulfillment_status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>สถานะชำระเงิน</Label>
                  <Select value={form.payment_status} onValueChange={(v) => setForm((f) => ({ ...f, payment_status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PAYMENT_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>เลขพัสดุ</Label>
                  <Input value={form.tracking_number} onChange={(e) => setForm((f) => ({ ...f, tracking_number: e.target.value }))} placeholder="เช่น TH123456789" />
                </div>
                <div className="space-y-2">
                  <Label>ลิงก์ติดตามพัสดุ</Label>
                  <Input value={form.tracking_url} onChange={(e) => setForm((f) => ({ ...f, tracking_url: e.target.value }))} placeholder="https://..." />
                </div>
              </div>

              <Card className="p-3 bg-primary/5 border-primary/20 text-sm space-y-2">
                <div className="font-medium">ลิงก์ให้ลูกค้าติดตามออเดอร์</div>
                <div className="flex gap-2">
                  <Input readOnly value={trackingLink(active)} className="text-xs" />
                  <Button variant="outline" size="icon" onClick={() => copyTracking(active)}><Copy className="h-4 w-4" /></Button>
                  <Button asChild variant="outline" size="icon"><a href={trackingLink(active)} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>
                </div>
              </Card>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActive(null)}>ปิด</Button>
            <Button onClick={saveStatus} disabled={saving} className="bg-gradient-primary">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}บันทึกและส่งเข้าแชท
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}