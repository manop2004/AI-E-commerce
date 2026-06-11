import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PackageCheck, Search, Truck, CheckCircle2, Clock, Loader2, ExternalLink } from "lucide-react";

const STEPS = [
  { value: "pending", label: "รับออเดอร์", icon: Clock },
  { value: "paid", label: "ชำระเงิน", icon: CheckCircle2 },
  { value: "preparing", label: "จัดเตรียม", icon: PackageCheck },
  { value: "packed", label: "แพ็กสินค้า", icon: PackageCheck },
  { value: "shipped", label: "จัดส่ง", icon: Truck },
  { value: "delivered", label: "สำเร็จ", icon: CheckCircle2 },
];

const LABELS: Record<string, string> = {
  pending: "รอยืนยัน",
  paid: "ชำระเงินแล้ว",
  preparing: "กำลังจัดเตรียมสินค้า",
  packed: "แพ็กสินค้าเรียบร้อย",
  shipped: "ส่งแล้ว",
  delivered: "จัดส่งสำเร็จ",
  cancelled: "ยกเลิกออเดอร์",
};

type Order = {
  order_number: string;
  customer_name: string;
  product_name: string;
  quantity: number;
  amount: number;
  fulfillment_status: string;
  payment_status: string;
  tracking_number: string | null;
  tracking_url: string | null;
  shipping_address: string | null;
  status_updated_at: string;
  created_at: string;
};

export default function OrderTracking() {
  const { ownerId } = useParams();
  const [params] = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(params.get("order") || "");
  const [phone, setPhone] = useState(params.get("phone") || "");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  const lookup = async () => {
    if (!ownerId || !orderNumber.trim() || !phone.trim()) return;
    setLoading(true);
    setError("");
    setSearched(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/order-lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ ownerId, orderNumber: orderNumber.trim(), phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "ค้นหาไม่สำเร็จ");
      setOrders(data.orders || []);
    } catch (e: any) {
      setOrders([]);
      setError(e.message || "ค้นหาไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderNumber && phone) lookup();
  }, []);

  const main = orders[0];
  const currentIndex = useMemo(() => Math.max(0, STEPS.findIndex((s) => s.value === (main?.fulfillment_status || "pending"))), [main]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40 bg-card/30">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-primary grid place-items-center shadow-glow"><PackageCheck className="h-5 w-5 text-primary-foreground" /></div>
          <div><div className="font-display font-bold">ติดตามคำสั่งซื้อ</div><div className="text-xs text-muted-foreground">ตรวจสถานะด้วยเลขออเดอร์และเบอร์โทร</div></div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <Card className="p-4 bg-gradient-card border-border/50 space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-2"><Label>เลขออเดอร์</Label><Input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="#A-12345" /></div>
            <div className="space-y-2"><Label>เบอร์โทรที่ใช้สั่งซื้อ</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08x-xxx-xxxx" /></div>
          </div>
          <Button onClick={lookup} disabled={loading || !orderNumber.trim() || !phone.trim()} className="w-full bg-gradient-primary">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}ตรวจสอบสถานะ
          </Button>
        </Card>

        {error && <Card className="p-4 border-destructive/40 bg-destructive/5 text-sm text-destructive">{error}</Card>}
        {searched && !loading && !error && orders.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground bg-gradient-card border-border/50">ไม่พบคำสั่งซื้อ กรุณาตรวจเลขออเดอร์และเบอร์โทรอีกครั้ง</Card>}

        {main && (
          <Card className="p-5 bg-gradient-card border-border/50 space-y-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div><div className="text-sm text-muted-foreground">คำสั่งซื้อ</div><h1 className="text-2xl font-bold">{main.order_number}</h1><div className="text-sm">{main.customer_name}</div></div>
              <Badge variant="outline" className={main.fulfillment_status === "cancelled" ? "border-destructive/40 text-destructive" : "border-primary/40 text-primary"}>{LABELS[main.fulfillment_status] || main.fulfillment_status}</Badge>
            </div>

            <div className="space-y-3">
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                const done = main.fulfillment_status === "cancelled" ? false : index <= currentIndex;
                return (
                  <div key={step.value} className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-full grid place-items-center ${done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}><Icon className="h-4 w-4" /></div>
                    <div className="flex-1"><div className="font-medium text-sm">{step.label}</div>{index === currentIndex && <div className="text-xs text-muted-foreground">อัปเดตล่าสุด {new Date(main.status_updated_at).toLocaleString("th-TH")}</div>}</div>
                  </div>
                );
              })}
            </div>

            <Separator />
            <div className="space-y-2">
              {orders.map((o) => <div key={o.product_name} className="flex justify-between gap-3 text-sm"><span>{o.product_name} × {o.quantity}</span><span className="font-semibold">฿{Number(o.amount).toLocaleString()}</span></div>)}
              <div className="flex justify-between font-bold pt-2"><span>รวม</span><span>฿{orders.reduce((s, o) => s + Number(o.amount || 0), 0).toLocaleString()}</span></div>
            </div>
            {main.shipping_address && <div className="rounded-lg border border-border/40 p-3 text-sm"><div className="text-xs text-muted-foreground mb-1">ที่อยู่จัดส่ง</div>{main.shipping_address}</div>}
            {(main.tracking_number || main.tracking_url) && <Card className="p-3 bg-primary/5 border-primary/20 text-sm space-y-1"><div className="font-medium">ข้อมูลพัสดุ</div>{main.tracking_number && <div>เลขพัสดุ: {main.tracking_number}</div>}{main.tracking_url && <Button asChild variant="outline" size="sm"><a href={main.tracking_url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />เปิดหน้าติดตามพัสดุ</a></Button>}</Card>}
          </Card>
        )}
      </main>
    </div>
  );
}