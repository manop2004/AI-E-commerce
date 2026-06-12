import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Ban, CheckCircle2, Trash2, Save, Loader2, Users, Package2, ToggleLeft, FileText, ReceiptText, LayoutDashboard } from "lucide-react";

type Profile = { id: string; email: string; full_name: string | null; suspended: boolean; created_at: string };
type Sub = { user_id: string; plan: string; status: string; amount: number | null };
type Role = { user_id: string; role: string };
type Plan = { key: string; name: string; price_monthly: number; price_yearly: number; features: string[]; highlight: boolean; is_active: boolean; sort_order: number };
type Feat = { feature_key: string; label: string; enabled: boolean; required_plan: string };
type Order = any;
type Invoice = any;

const PLAN_TIERS = ["free", "starter", "growth", "enterprise"];

export default function Admin() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [feats, setFeats] = useState<Feat[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  const loadAll = async () => {
    setLoading(true);
    const [u, s, r, p, f, o, i] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("subscriptions").select("*"),
      supabase.from("user_roles").select("*"),
      supabase.from("plans").select("*").order("sort_order"),
      supabase.from("platform_features").select("*").order("feature_key"),
      supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("invoices").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    setUsers((u.data as any) || []);
    setSubs((s.data as any) || []);
    setRoles((r.data as any) || []);
    setPlans(((p.data as any) || []).map((x: any) => ({ ...x, features: Array.isArray(x.features) ? x.features : [] })));
    setFeats((f.data as any) || []);
    setOrders((o.data as any) || []);
    setInvoices((i.data as any) || []);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const callUserAction = async (action: string, userId: string, role?: string) => {
    const { data, error } = await supabase.functions.invoke("admin-users", { body: { action, userId, role } });
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Action failed");
      return false;
    }
    toast.success("เรียบร้อย");
    await loadAll();
    return true;
  };

  const togglePlatformFeat = async (key: string, enabled: boolean) => {
    setFeats((p) => p.map((x) => (x.feature_key === key ? { ...x, enabled } : x)));
    const { error } = await supabase.from("platform_features").update({ enabled }).eq("feature_key", key);
    if (error) toast.error(error.message);
  };

  const setRequiredPlan = async (key: string, plan: string) => {
    setFeats((p) => p.map((x) => (x.feature_key === key ? { ...x, required_plan: plan } : x)));
    const { error } = await supabase.from("platform_features").update({ required_plan: plan }).eq("feature_key", key);
    if (error) toast.error(error.message);
  };

  const savePlan = async () => {
    if (!editingPlan) return;
    const { key, ...rest } = editingPlan;
    const { error } = await supabase.from("plans").update(rest).eq("key", key);
    if (error) toast.error(error.message);
    else { toast.success("บันทึกแพ็คเกจแล้ว"); setEditingPlan(null); await loadAll(); }
  };

  const mrr = subs.reduce((acc, s) => acc + Number(s.amount || 0), 0);
  const activeSubs = subs.filter((s) => s.status === "active").length;
  const isUserAdmin = (uid: string) => roles.some((r) => r.user_id === uid && r.role === "admin");

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">Admin Console</h1>
        <p className="text-muted-foreground mt-1">จัดการแพลตฟอร์ม ผู้ใช้ ฟีเจอร์ และราคา</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full">
          <TabsTrigger value="overview" className="gap-1"><LayoutDashboard className="h-4 w-4" />Overview</TabsTrigger>
          <TabsTrigger value="users" className="gap-1"><Users className="h-4 w-4" />Users</TabsTrigger>
          <TabsTrigger value="plans" className="gap-1"><Package2 className="h-4 w-4" />Plans</TabsTrigger>
          <TabsTrigger value="features" className="gap-1"><ToggleLeft className="h-4 w-4" />Features</TabsTrigger>
          <TabsTrigger value="orders" className="gap-1"><FileText className="h-4 w-4" />Orders</TabsTrigger>
          <TabsTrigger value="invoices" className="gap-1"><ReceiptText className="h-4 w-4" />Invoices</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid md:grid-cols-4 gap-4">
            <Card className="p-5 bg-gradient-card border-border/50"><div className="text-xs text-muted-foreground">Total users</div><div className="font-display text-3xl font-bold mt-2">{users.length}</div></Card>
            <Card className="p-5 bg-gradient-card border-border/50"><div className="text-xs text-muted-foreground">Active subs</div><div className="font-display text-3xl font-bold mt-2">{activeSubs}</div></Card>
            <Card className="p-5 bg-gradient-card border-border/50"><div className="text-xs text-muted-foreground">MRR</div><div className="font-display text-3xl font-bold mt-2">฿{mrr.toLocaleString()}</div></Card>
            <Card className="p-5 bg-gradient-card border-border/50"><div className="text-xs text-muted-foreground">ARR</div><div className="font-display text-3xl font-bold mt-2">฿{(mrr * 12).toLocaleString()}</div></Card>
          </div>
          <Card className="p-5 bg-gradient-card border-border/50">
            <h3 className="font-display font-semibold mb-3">Suspended users</h3>
            <div className="text-sm">{users.filter((u) => u.suspended).length} คน</div>
          </Card>
        </TabsContent>

        {/* USERS */}
        <TabsContent value="users">
          <Card className="p-0 bg-gradient-card border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const s = subs.find((x) => x.user_id === u.id);
                  const isAdm = isUserAdmin(u.id);
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{u.full_name || u.email}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{s?.plan || "free"}</Badge></TableCell>
                      <TableCell>
                        <Select value={isAdm ? "admin" : "customer"} onValueChange={(v) => callUserAction("set_role", u.id, v)}>
                          <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="customer">Customer</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {u.suspended
                          ? <Badge variant="destructive">ระงับ</Badge>
                          : <Badge className="bg-success/20 text-success border-0">ปกติ</Badge>}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {u.suspended ? (
                          <Button size="sm" variant="outline" onClick={() => callUserAction("unsuspend", u.id)}>
                            <CheckCircle2 className="h-4 w-4" />ปลดระงับ
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => callUserAction("suspend", u.id)}>
                            <Ban className="h-4 w-4" />ระงับ
                          </Button>
                        )}
                        <Button size="sm" variant="destructive" onClick={() => {
                          if (confirm(`ลบบัญชี ${u.email}? ไม่สามารถกู้คืนได้`)) callUserAction("delete", u.id);
                        }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* PLANS */}
        <TabsContent value="plans">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((p) => (
              <Card key={p.key} className={`p-5 bg-gradient-card border-border/50 ${p.highlight ? "border-primary" : ""}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-display font-bold text-lg">{p.name}</div>
                    <div className="text-xs text-muted-foreground uppercase">{p.key}</div>
                  </div>
                  {p.highlight && <Badge className="bg-gradient-primary border-0">Popular</Badge>}
                </div>
                <div className="my-3">
                  <div className="font-display text-2xl font-bold">฿{Number(p.price_monthly).toLocaleString()}<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
                  <div className="text-xs text-muted-foreground">฿{Number(p.price_yearly).toLocaleString()}/yr</div>
                </div>
                <ul className="text-xs space-y-1 mb-3 text-muted-foreground">
                  {p.features.map((f, i) => <li key={i}>• {f}</li>)}
                </ul>
                <Button size="sm" variant="outline" className="w-full" onClick={() => setEditingPlan(p)}>แก้ไข</Button>
              </Card>
            ))}
          </div>

          <Dialog open={!!editingPlan} onOpenChange={(o) => !o && setEditingPlan(null)}>
            <DialogContent>
              <DialogHeader><DialogTitle>แก้ไขแพ็คเกจ {editingPlan?.name}</DialogTitle></DialogHeader>
              {editingPlan && (
                <div className="space-y-3">
                  <div><Label>ชื่อ</Label><Input value={editingPlan.name} onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>รายเดือน (฿)</Label><Input type="number" value={editingPlan.price_monthly} onChange={(e) => setEditingPlan({ ...editingPlan, price_monthly: Number(e.target.value) })} /></div>
                    <div><Label>รายปี (฿)</Label><Input type="number" value={editingPlan.price_yearly} onChange={(e) => setEditingPlan({ ...editingPlan, price_yearly: Number(e.target.value) })} /></div>
                  </div>
                  <div><Label>ฟีเจอร์ (บรรทัดละ 1 ข้อ)</Label>
                    <Textarea rows={5} value={editingPlan.features.join("\n")}
                      onChange={(e) => setEditingPlan({ ...editingPlan, features: e.target.value.split("\n").filter(Boolean) })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Popular badge</Label>
                    <Switch checked={editingPlan.highlight} onCheckedChange={(v) => setEditingPlan({ ...editingPlan, highlight: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>เปิดให้สมัคร</Label>
                    <Switch checked={editingPlan.is_active} onCheckedChange={(v) => setEditingPlan({ ...editingPlan, is_active: v })} />
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingPlan(null)}>ยกเลิก</Button>
                <Button onClick={savePlan} className="bg-gradient-primary"><Save className="h-4 w-4" />บันทึก</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* PLATFORM FEATURES */}
        <TabsContent value="features">
          <Card className="p-0 bg-gradient-card border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ฟีเจอร์</TableHead>
                  <TableHead>เปิดทั้งระบบ</TableHead>
                  <TableHead>เปิดให้แพ็คขั้นต่ำ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feats.map((f) => (
                  <TableRow key={f.feature_key}>
                    <TableCell>
                      <div className="font-medium text-sm">{f.label}</div>
                      <div className="text-xs text-muted-foreground">{f.feature_key}</div>
                    </TableCell>
                    <TableCell><Switch checked={f.enabled} onCheckedChange={(v) => togglePlatformFeat(f.feature_key, v)} /></TableCell>
                    <TableCell>
                      <Select value={f.required_plan} onValueChange={(v) => setRequiredPlan(f.feature_key, v)}>
                        <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>{PLAN_TIERS.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ORDERS */}
        <TabsContent value="orders">
          <Card className="p-0 bg-gradient-card border-border/50 overflow-hidden">
            <Table>
              <TableHeader><TableRow>
                <TableHead>เลข</TableHead><TableHead>ลูกค้า</TableHead><TableHead>สินค้า</TableHead>
                <TableHead>ยอด</TableHead><TableHead>สถานะ</TableHead><TableHead>ช่อง</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {orders.slice(0, 100).map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.order_number}</TableCell>
                    <TableCell>{o.customer_name}</TableCell>
                    <TableCell className="text-xs">{o.product_name}</TableCell>
                    <TableCell>฿{Number(o.amount).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="outline">{o.fulfillment_status || o.status}</Badge></TableCell>
                    <TableCell className="text-xs">{o.channel}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* INVOICES */}
        <TabsContent value="invoices">
          <Card className="p-0 bg-gradient-card border-border/50 overflow-hidden">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Invoice</TableHead><TableHead>ยอด</TableHead><TableHead>สถานะ</TableHead><TableHead>วันที่</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {invoices.map((iv) => (
                  <TableRow key={iv.id}>
                    <TableCell className="font-mono text-xs">{iv.number || iv.id?.slice(0, 8)}</TableCell>
                    <TableCell>฿{Number(iv.amount || 0).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="outline">{iv.status}</Badge></TableCell>
                    <TableCell className="text-xs">{iv.created_at && new Date(iv.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
                {invoices.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">ยังไม่มีใบเสร็จ</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}