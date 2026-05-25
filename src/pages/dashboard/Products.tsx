import { useEffect, useRef, useState } from "react";
import readXlsxFile from "read-excel-file";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, Plus, Pencil, Trash2, Search, ImageIcon, Loader2, AlertTriangle, Upload, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

type Product = {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  price: number;
  compare_at_price: number | null;
  stock: number;
  low_stock_threshold: number;
  image_url: string | null;
  category: string | null;
  status: string;
};

const empty: Partial<Product> = { name: "", description: "", sku: "", price: 0, stock: 0, low_stock_threshold: 5, status: "active", category: "" };

type ImportedProduct = {
  name: string;
  description: string | null;
  sku: string | null;
  price: number;
  compare_at_price: number | null;
  stock: number;
  low_stock_threshold: number;
  category: string | null;
  status: string;
};

const headerAliases: Record<keyof ImportedProduct, string[]> = {
  name: ["name", "title", "product", "productname", "ชื่อ", "ชื่อสินค้า", "สินค้า", "รายการสินค้า"],
  description: ["description", "detail", "details", "รายละเอียด", "คำอธิบาย"],
  sku: ["sku", "code", "รหัส", "รหัสสินค้า", "บาร์โค้ด", "barcode"],
  price: ["price", "sellprice", "saleprice", "ราคา", "ราคาขาย"],
  compare_at_price: ["compareatprice", "originalprice", "ราคาเต็ม", "ราคาปกติ"],
  stock: ["stock", "inventory", "qty", "quantity", "จำนวน", "สต็อก", "คงเหลือ", "เหลือ"],
  low_stock_threshold: ["lowstockthreshold", "แจ้งเตือนสต็อก", "เตือนเมื่อเหลือ"],
  category: ["category", "type", "หมวดหมู่", "ประเภท"],
  status: ["status", "สถานะ"],
};

const normalizeHeader = (value: unknown) => String(value || "").toLowerCase().replace(/[\s_\-()]/g, "").trim();
const parseNumber = (value: unknown, fallback = 0) => {
  const n = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : fallback;
};

const csvToRows = (text: string) => {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"' && quoted && next === '"') { current += '"'; i++; continue; }
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === "," && !quoted) { row.push(current.trim()); current = ""; continue; }
    if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && next === "\n") i++;
      row.push(current.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      current = "";
      continue;
    }
    current += ch;
  }
  row.push(current.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
};

const rowsToProducts = (rows: unknown[][]): ImportedProduct[] => {
  const cleanRows = rows.filter((r) => r.some((c) => String(c ?? "").trim()));
  if (cleanRows.length === 0) return [];
  const first = cleanRows[0].map(normalizeHeader);
  const hasHeader = Object.values(headerAliases).some((aliases) => aliases.some((a) => first.includes(normalizeHeader(a))));
  const headers = hasHeader ? cleanRows[0] : ["name", "sku", "price", "stock", "category", "description"];
  const body = hasHeader ? cleanRows.slice(1) : cleanRows;
  const findIndex = (field: keyof ImportedProduct) => headers.findIndex((h) => headerAliases[field].some((a) => normalizeHeader(h) === normalizeHeader(a)));
  const index = {
    name: findIndex("name"),
    description: findIndex("description"),
    sku: findIndex("sku"),
    price: findIndex("price"),
    compare_at_price: findIndex("compare_at_price"),
    stock: findIndex("stock"),
    low_stock_threshold: findIndex("low_stock_threshold"),
    category: findIndex("category"),
    status: findIndex("status"),
  };
  return body.map((row) => {
    const pick = (i: number) => (i >= 0 ? row[i] : "");
    return {
      name: String(pick(index.name) || "").trim(),
      description: String(pick(index.description) || "").trim() || null,
      sku: String(pick(index.sku) || "").trim() || null,
      price: parseNumber(pick(index.price), 0),
      compare_at_price: index.compare_at_price >= 0 ? parseNumber(pick(index.compare_at_price), 0) || null : null,
      stock: Math.max(0, Math.round(parseNumber(pick(index.stock), 0))),
      low_stock_threshold: Math.max(0, Math.round(parseNumber(pick(index.low_stock_threshold), 5))),
      category: String(pick(index.category) || "").trim() || null,
      status: String(pick(index.status) || "active").trim() || "active",
    };
  }).filter((p) => p.name);
};

export default function Products() {
  const { user } = useAuth();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Product>>(empty);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    setItems((data as Product[]) || []);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const filtered = items.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) || (p.sku || "").toLowerCase().includes(q.toLowerCase()));

  const openNew = () => { setEditing(empty); setImageFile(null); setOpen(true); };
  const openEdit = (p: Product) => { setEditing(p); setImageFile(null); setOpen(true); };

  const save = async () => {
    if (!user || !editing.name?.trim()) { toast.error("กรุณาใส่ชื่อสินค้า"); return; }
    setSaving(true);
    try {
      let image_url = editing.image_url || null;
      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("product-images").upload(path, imageFile, { upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
        image_url = pub.publicUrl;
      }
      const payload = {
        user_id: user.id,
        name: editing.name!,
        description: editing.description || null,
        sku: editing.sku || null,
        price: Number(editing.price) || 0,
        compare_at_price: editing.compare_at_price ? Number(editing.compare_at_price) : null,
        stock: Number(editing.stock) || 0,
        low_stock_threshold: Number(editing.low_stock_threshold) || 5,
        category: editing.category || null,
        status: editing.status || "active",
        image_url,
      };
      if (editing.id) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("อัปเดตสินค้าแล้ว");
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
        toast.success("เพิ่มสินค้าแล้ว");
      }
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("ลบสินค้านี้?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("ลบแล้ว");
    load();
  };

  const stockBadge = (p: Product) => {
    if (p.stock === 0) return <Badge variant="outline" className="border-destructive/40 text-destructive"><AlertTriangle className="h-3 w-3 mr-1" />หมด</Badge>;
    if (p.stock <= p.low_stock_threshold) return <Badge variant="outline" className="border-warning/40 text-warning">ใกล้หมด ({p.stock})</Badge>;
    return <Badge variant="outline" className="border-success/40 text-success">มี {p.stock} ชิ้น</Badge>;
  };

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold flex items-center gap-2"><Package className="h-7 w-7" />สินค้าของร้าน</h1>
          <p className="text-sm text-muted-foreground">จัดการสินค้า สต็อก และราคา — AI จะใช้ข้อมูลนี้แนะนำลูกค้า</p>
        </div>
        <Button onClick={openNew} className="bg-gradient-primary"><Plus className="h-4 w-4" />เพิ่มสินค้า</Button>
      </div>

      <Card className="p-3 bg-gradient-card border-border/50">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาด้วยชื่อหรือ SKU..." className="pl-9" />
        </div>
      </Card>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center bg-gradient-card border-border/50">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">ยังไม่มีสินค้า เพิ่มสินค้าแรกของคุณเลย</p>
          <Button onClick={openNew} className="bg-gradient-primary"><Plus className="h-4 w-4" />เพิ่มสินค้า</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <Card key={p.id} className="bg-gradient-card border-border/50 overflow-hidden group">
              <div className="aspect-video bg-muted/30 grid place-items-center overflow-hidden">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="h-10 w-10 text-muted-foreground" />
                )}
              </div>
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{p.name}</div>
                    {p.sku && <div className="text-xs text-muted-foreground">SKU: {p.sku}</div>}
                  </div>
                  {p.status !== "active" && <Badge variant="outline" className="text-xs">{p.status}</Badge>}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold">฿{Number(p.price).toLocaleString()}</span>
                  {p.compare_at_price && <span className="text-xs text-muted-foreground line-through">฿{Number(p.compare_at_price).toLocaleString()}</span>}
                </div>
                {stockBadge(p)}
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(p)}><Pencil className="h-3 w-3" />แก้ไข</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(p.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing.id ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>ชื่อสินค้า *</Label>
              <Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} maxLength={200} />
            </div>
            <div>
              <Label>รายละเอียด</Label>
              <Textarea value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={3} maxLength={2000} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>SKU</Label>
                <Input value={editing.sku || ""} onChange={(e) => setEditing({ ...editing, sku: e.target.value })} maxLength={64} />
              </div>
              <div>
                <Label>หมวดหมู่</Label>
                <Input value={editing.category || ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} maxLength={64} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>ราคา (บาท) *</Label>
                <Input type="number" min={0} value={editing.price ?? 0} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} />
              </div>
              <div>
                <Label>ราคาเต็ม (ขีดฆ่า)</Label>
                <Input type="number" min={0} value={editing.compare_at_price ?? ""} onChange={(e) => setEditing({ ...editing, compare_at_price: e.target.value ? Number(e.target.value) : null })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>สต็อก</Label>
                <Input type="number" min={0} value={editing.stock ?? 0} onChange={(e) => setEditing({ ...editing, stock: Number(e.target.value) })} />
              </div>
              <div>
                <Label>เตือนเมื่อเหลือ ≤</Label>
                <Input type="number" min={0} value={editing.low_stock_threshold ?? 5} onChange={(e) => setEditing({ ...editing, low_stock_threshold: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label>สถานะ</Label>
              <Select value={editing.status || "active"} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">วางขาย</SelectItem>
                  <SelectItem value="draft">ฉบับร่าง</SelectItem>
                  <SelectItem value="archived">เลิกขาย</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>รูปสินค้า</Label>
              <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
              {editing.image_url && !imageFile && <img src={editing.image_url} alt="" className="mt-2 h-20 rounded object-cover" />}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>ยกเลิก</Button>
            <Button onClick={save} disabled={saving} className="bg-gradient-primary">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
