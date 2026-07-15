import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { Package, Plus, Pencil, Trash2, Search, ImageIcon, Loader2, AlertTriangle, Upload, FileSpreadsheet, Download } from "lucide-react";
import { toast } from "sonner";
import { buildStockTrainingContent, parseStockFile, downloadStockTemplate } from "@/lib/stockImport";

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

export default function Products() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Product>>(empty);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [draggingStock, setDraggingStock] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

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
    if (!user || !editing.name?.trim()) { toast.error(t("products.errorNoName", "กรุณาใส่ชื่อสินค้า")); return; }
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
        toast.success(t("products.successUpdate", "อัปเดตสินค้าแล้ว"));
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
        toast.success(t("products.successAdd", "เพิ่มสินค้าแล้ว"));
      }
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message || t("products.errorSave", "บันทึกไม่สำเร็จ"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm(t("products.deleteConfirm", "ลบสินค้านี้?"))) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("products.successDelete", "ลบแล้ว"));
    load();
  };

  const importStockFile = async (file?: File) => {
    if (!user || !file) return;
    setImporting(true);
    try {
      const parsed = await parseStockFile(file);
      const imported = parsed.slice(0, 1000);
      if (!imported.length) {
        throw new Error(t("products.errorNoData", "ไม่พบข้อมูลสินค้าในไฟล์ — กรุณาดาวน์โหลดเทมเพลตและกรอกตามตัวอย่าง (แถวแรกต้องเป็นหัวคอลัมน์: ชื่อสินค้า, ราคา, สต็อก ...)"));
      }
      const noName = imported.filter((p) => !p.name?.trim()).length;
      if (noName === imported.length) {
        throw new Error(t("products.errorNoNameCol", "ทุกแถวไม่มีชื่อสินค้า — เช็คคอลัมน์ 'ชื่อสินค้า' (name) ในไฟล์"));
      }

      const existingBySku = new Map(items.filter((p) => p.sku).map((p) => [p.sku!.toLowerCase(), p]));
      const existingByName = new Map(items.map((p) => [p.name.toLowerCase(), p]));
      const inserts: any[] = [];
      const updates: { id: string; payload: any }[] = [];

      imported.forEach((p) => {
        const matched = (p.sku && existingBySku.get(p.sku.toLowerCase())) || existingByName.get(p.name.toLowerCase());
        const payload = { user_id: user.id, ...p };
        if (matched) updates.push({ id: matched.id, payload });
        else inserts.push(payload);
      });

      if (inserts.length) {
        const { error } = await supabase.from("products").insert(inserts);
        if (error) {
          throw new Error(`Insert Error: ${error.message}`);
        }
      }
      if (updates.length) {
        const results = await Promise.all(updates.map((u) => supabase.from("products").update(u.payload).eq("id", u.id)));
        const failed = results.find((r) => r.error);
        if (failed?.error) {
          throw new Error(`Update Error: ${failed.error.message}`);
        }
      }

      const { error: trainErr } = await supabase.from("training_documents").insert({
        user_id: user.id,
        doc_type: "excel",
        title: `Stock: ${file.name}`,
        content: buildStockTrainingContent(imported),
        status: "ready",
      });
      if (trainErr) console.error("Training insert error", trainErr);

      toast.success(`นำเข้าสำเร็จ ${imported.length} รายการ (เพิ่มใหม่ ${inserts.length} / อัปเดต ${updates.length})`);
      await load();
    } catch (e: any) {
      console.error("Stock import error", e);
      toast.error(e.message || "นำเข้าไฟล์ไม่สำเร็จ", { duration: 8000 });
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  const stockBadge = (p: Product) => {
    if (p.stock === 0) return <Badge variant="outline" className="border-destructive/40 text-destructive"><AlertTriangle className="h-3 w-3 mr-1" />{t("products.outOfStock", "หมด")}</Badge>;
    if (p.stock <= p.low_stock_threshold) return <Badge variant="outline" className="border-warning/40 text-warning">{t("products.lowStock", "ใกล้หมด", { count: p.stock })} ({p.stock})</Badge>;
    return <Badge variant="outline" className="border-success/40 text-success">{t("products.inStock", "มี {{count}} ชิ้น", { count: p.stock })}</Badge>;
  };

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold flex items-center gap-2"><Package className="h-7 w-7" />{t("products.title", "สินค้าของร้าน")}</h1>
          <p className="text-sm text-muted-foreground">{t("products.subtitle", "จัดการสินค้า สต็อก และราคา — AI จะใช้ข้อมูลนี้แนะนำลูกค้า")}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,.xlsx"
            className="hidden"
            onChange={(e) => importStockFile(e.target.files?.[0])}
          />
          <Button variant="ghost" onClick={downloadStockTemplate}>
            <Download className="h-4 w-4 mr-2" />{t("products.downloadTemplate", "ดาวน์โหลดเทมเพลต")}
          </Button>
          <Button variant="outline" onClick={() => importInputRef.current?.click()} disabled={importing}>
            {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            {t("products.importStock", "นำเข้าไฟล์สต็อก")}
          </Button>
          <Button onClick={openNew} className="bg-gradient-primary"><Plus className="h-4 w-4 mr-2" />{t("products.addProduct", "เพิ่มสินค้า")}</Button>
        </div>
      </div>

      <Card
        className={`p-4 bg-gradient-card border-border/50 border-dashed transition ${draggingStock ? "border-primary shadow-glow" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDraggingStock(true); }}
        onDragLeave={() => setDraggingStock(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDraggingStock(false);
          importStockFile(e.dataTransfer.files?.[0]);
        }}
      >
        <div className="flex items-start gap-3 text-sm text-muted-foreground">
          <FileSpreadsheet className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-2">
            <div className="font-medium text-foreground">{t("products.dragDrop", "ลากไฟล์ CSV / XLSX มาวางตรงนี้ หรือกดปุ่มนำเข้าไฟล์สต็อก")}</div>
            <div>{t("products.importNote", "รายการที่มี SKU หรือชื่อซ้ำจะอัปเดตสต็อกเดิม สูงสุด 1,000 รายการต่อครั้ง")}</div>
            <div className="rounded-md border border-border/40 bg-background/60 p-2 font-mono text-[11px] leading-5 overflow-x-auto">
              <div className="text-foreground">{t("products.headers", "ชื่อสินค้า, รหัสสินค้า, ราคา, ราคาเต็ม, สต็อก, หมวดหมู่, รายละเอียด")}</div>
              <div>{t("products.example1", "เสื้อยืดคอกลมสีขาว, TS-WHT-M, 290, 390, 25, เสื้อผ้า, ผ้าฝ้าย 100%")}</div>
              <div>{t("products.example2", "กางเกงยีนส์ทรงสลิม, JN-SLM-32, 890, 1290, 12, เสื้อผ้า, ทรงสลิม")}</div>
              <div>{t("products.example3", "รองเท้าผ้าใบสีดำ, SK-BLK-42, 1290, 1590, 8, รองเท้า, รุ่นคลาสสิก")}</div>
            </div>
            <div className="text-xs">{t("products.headerNote", "ต้องมีแถวแรกเป็นหัวคอลัมน์ — กดปุ่ม 'ดาวน์โหลดเทมเพลต' เพื่อรับไฟล์ตัวอย่าง")}</div>
          </div>
        </div>
      </Card>

      <Card className="p-3 bg-gradient-card border-border/50">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("products.search", "ค้นหาด้วยชื่อหรือ SKU...")} className="pl-9" />
        </div>
      </Card>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center bg-gradient-card border-border/50">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">{t("products.emptyState", "ยังไม่มีสินค้า เพิ่มสินค้าแรกของคุณเลย")}</p>
          <Button onClick={openNew} className="bg-gradient-primary"><Plus className="h-4 w-4 mr-2" />{t("products.addProduct", "เพิ่มสินค้า")}</Button>
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
                  {p.status !== "active" && <Badge variant="outline" className="text-xs">{t(`products.status${p.status.charAt(0).toUpperCase() + p.status.slice(1)}`, p.status)}</Badge>}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold">฿{Number(p.price).toLocaleString()}</span>
                  {p.compare_at_price && <span className="text-xs text-muted-foreground line-through">฿{Number(p.compare_at_price).toLocaleString()}</span>}
                </div>
                {stockBadge(p)}
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(p)}><Pencil className="h-3 w-3 mr-2" />{t("products.edit", "แก้ไข")}</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(p.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-3 w-3 mr-2" />{t("products.delete", "ลบ")}</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing.id ? t("products.editTitle", "แก้ไขสินค้า") : t("products.addTitle", "เพิ่มสินค้า")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("products.name", "ชื่อสินค้า *")}</Label>
              <Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} maxLength={200} />
            </div>
            <div>
              <Label>{t("products.description", "รายละเอียด")}</Label>
              <Textarea value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={3} maxLength={2000} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("products.sku", "SKU")}</Label>
                <Input value={editing.sku || ""} onChange={(e) => setEditing({ ...editing, sku: e.target.value })} maxLength={64} />
              </div>
              <div>
                <Label>{t("products.category", "หมวดหมู่")}</Label>
                <Input value={editing.category || ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} maxLength={64} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("products.price", "ราคา (บาท) *")}</Label>
                <Input type="number" min={0} value={editing.price ?? 0} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} />
              </div>
              <div>
                <Label>{t("products.comparePrice", "ราคาเต็ม (ขีดฆ่า)")}</Label>
                <Input type="number" min={0} value={editing.compare_at_price ?? ""} onChange={(e) => setEditing({ ...editing, compare_at_price: e.target.value ? Number(e.target.value) : null })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("products.stock", "สต็อก")}</Label>
                <Input type="number" min={0} value={editing.stock ?? 0} onChange={(e) => setEditing({ ...editing, stock: Number(e.target.value) })} />
              </div>
              <div>
                <Label>{t("products.lowStockAlert", "เตือนเมื่อเหลือ ≤")}</Label>
                <Input type="number" min={0} value={editing.low_stock_threshold ?? 5} onChange={(e) => setEditing({ ...editing, low_stock_threshold: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label>{t("products.status", "สถานะ")}</Label>
              <Select value={editing.status || "active"} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t("products.statusActive", "วางขาย")}</SelectItem>
                  <SelectItem value="draft">{t("products.statusDraft", "ฉบับร่าง")}</SelectItem>
                  <SelectItem value="archived">{t("products.statusArchived", "เลิกขาย")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("products.image", "รูปสินค้า")}</Label>
              <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
              {editing.image_url && !imageFile && <img src={editing.image_url} alt="" className="mt-2 h-20 rounded object-cover" />}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t("products.cancel", "ยกเลิก")}</Button>
            <Button onClick={save} disabled={saving} className="bg-gradient-primary">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}{t("products.save", "บันทึก")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}