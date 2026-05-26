import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  FileSpreadsheet,
  HelpCircle,
  Globe,
  Mic,
  Tag,
  Plus,
  Trash2,
  Edit2,
  Eye,
  Loader2,
  Upload,
  X
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { buildStockTrainingContent, parseStockFile } from "@/lib/stockImport";

const TYPES = [
  { type: "pdf", icon: FileText, label: "PDF Documents" },
  { type: "excel", icon: FileSpreadsheet, label: "Excel Catalog" },
  { type: "faq", icon: HelpCircle, label: "FAQ" },
  { type: "url", icon: Globe, label: "Website URL" },
  { type: "tone", icon: Mic, label: "Tone of Voice" },
  { type: "promo", icon: Tag, label: "Promotion Rules" },
];

export default function Training() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [docs, setDocs] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState("faq");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingDoc, setEditingDoc] = useState<any>(null);
  const [viewingDoc, setViewingDoc] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("training_documents")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
    } else {
      setDocs(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  const handleFileUpload = async (docFile: File) => {
    if (!user) return null;
    setUploading(true);
    try {
      const ext = docFile.name.split(".").pop();
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("training-docs")
        .upload(path, docFile);
      
      if (upErr) throw upErr;
      
      const { data: pub } = supabase.storage
        .from("training-docs")
        .getPublicUrl(path);
        
      return pub.publicUrl;
    } catch (error: any) {
      toast.error("Upload failed: " + error.message);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const add = async () => {
    const resolvedTitle = title.trim() || file?.name || "ข้อมูลฝึกสอน";
    if (!user || !resolvedTitle) {
      toast.error("กรุณาใส่หัวข้อ");
      return;
    }
    
    let url = null;
    let resolvedContent = content;
    if (file) {
      if (type === "excel") {
        const imported = (await parseStockFile(file)).slice(0, 1000);
        if (!imported.length) {
          toast.error("ไม่พบข้อมูลสินค้าในไฟล์");
          return;
        }

        const { data: existing } = await supabase
          .from("products")
          .select("id,name,sku")
          .eq("user_id", user.id);
        const existingBySku = new Map(((existing || []) as any[]).filter((p) => p.sku).map((p) => [String(p.sku).toLowerCase(), p]));
        const existingByName = new Map(((existing || []) as any[]).map((p) => [String(p.name).toLowerCase(), p]));
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
          if (error) throw error;
        }
        if (updates.length) {
          const results = await Promise.all(updates.map((u) => supabase.from("products").update(u.payload).eq("id", u.id)));
          const failed = results.find((r) => r.error);
          if (failed?.error) throw failed.error;
        }

        resolvedContent = `${content ? `${content.trim()}\n\n` : ""}${buildStockTrainingContent(imported)}`;
      }
      url = await handleFileUpload(file);
      if (!url) return;
    }

    const { error } = await supabase.from("training_documents").insert({
      user_id: user.id,
      doc_type: type,
      title: resolvedTitle,
      content: resolvedContent,
      url,
      status: "ready",
    });

    if (error) {
      toast.error(error.message);
    } else {
      setTitle("");
      setContent("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success(type === "excel" ? "นำเข้าสต็อกและสอนบอทเรียบร้อย" : "เพิ่มข้อมูลสอนบอทแล้ว");
      load();
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Are you sure you want to delete this training data?")) return;
    const { error } = await supabase.from("training_documents").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Deleted successfully");
      load();
    }
  };

  const update = async () => {
    if (!editingDoc) return;
    const { error } = await supabase
      .from("training_documents")
      .update({
        title: editingDoc.title,
        content: editingDoc.content,
      })
      .eq("id", editingDoc.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Updated successfully");
      setEditingDoc(null);
      load();
    }
  };

  const isFileType = type === "pdf" || type === "excel";

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">{t("dash.training")}</h1>
        <p className="text-muted-foreground mt-1">สอนบอทให้รู้จักสินค้า แบรนด์ และวิธีตอบของคุณ</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {TYPES.map((t) => (
          <Card
            key={t.type}
            onClick={() => {
              setType(t.type);
              setFile(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            className={`p-4 cursor-pointer transition bg-gradient-card border-border/50 hover:border-primary/40 flex flex-col items-center justify-center gap-2 text-center ${
              type === t.type ? "border-primary shadow-glow ring-1 ring-primary/20" : ""
            }`}
          >
            <t.icon className={`h-6 w-6 ${type === t.type ? "text-primary" : "text-muted-foreground"}`} />
            <span className={`font-medium text-xs ${type === t.type ? "text-primary" : ""}`}>{t.label}</span>
          </Card>
        ))}
      </div>

      <Card className="p-6 bg-gradient-card border-border/50">
        <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" />
          เพิ่มข้อมูลฝึกสอน ({TYPES.find(t => t.type === type)?.label})
        </h3>
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>หัวข้อ / ชื่อข้อมูล</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="เช่น ข้อมูลการรับประกันสินค้า, FAQ ชุดใหม่"
              />
            </div>
            {isFileType && (
              <div className="space-y-2">
                <Label>อัปโหลดไฟล์ (PDF, Excel)</Label>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    accept={type === "pdf" ? ".pdf" : ".xlsx,.xls,.csv"}
                    className="flex-1"
                  />
                  {file && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>รายละเอียด / ข้อความที่ต้องการสอน</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder={isFileType ? "สรุปย่อเกี่ยวกับไฟล์นี้ (ถ้ามี)" : "พิมพ์รายละเอียดที่ต้องการให้บอทจำ..."}
            />
          </div>
          <Button
            onClick={add}
            disabled={uploading}
            className="bg-gradient-primary w-full md:w-auto"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            เพิ่มลงในระบบฝึกสอน
          </Button>
        </div>
      </Card>

      <Card className="p-6 bg-gradient-card border-border/50">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display font-semibold">รายการที่เคยสอนแล้ว ({docs.length})</h3>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        
        <div className="space-y-3">
          {docs.length === 0 && !loading && (
            <div className="text-center py-12 border border-dashed rounded-lg bg-card/30">
              <HelpCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-20" />
              <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูลการฝึกสอน</p>
            </div>
          )}
          
          {docs.map((d) => {
            const T = TYPES.find((t) => t.type === d.doc_type) || TYPES[0];
            return (
              <div
                key={d.id}
                className="flex items-center gap-3 p-4 rounded-xl bg-card/50 border border-border/40 hover:border-primary/30 transition-colors group"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <T.icon className="h-5 w-5 text-primary" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="font-semibold text-sm truncate">{d.title}</div>
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 uppercase font-bold">
                      {d.doc_type}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate opacity-70">
                    {d.content || (d.url ? "Linked file: " + d.url.split("/").pop() : "No content")}
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    onClick={() => setViewingDoc(d)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    onClick={() => setEditingDoc(d)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(d.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* View Dialog */}
      <Dialog open={!!viewingDoc} onOpenChange={(open) => !open && setViewingDoc(null)}>
        <DialogContent className="max-w-2xl bg-gradient-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewingDoc && (() => {
                const T = TYPES.find(t => t.type === viewingDoc.doc_type) || TYPES[0];
                return <T.icon className="h-5 w-5 text-primary" />;
              })()}
              รายละเอียดข้อมูลฝึกสอน
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-xs uppercase text-muted-foreground font-bold">หัวข้อ</Label>
              <div className="text-lg font-semibold mt-1">{viewingDoc?.title}</div>
            </div>
            <div>
              <Label className="text-xs uppercase text-muted-foreground font-bold">ประเภท</Label>
              <div className="mt-1">
                <Badge variant="secondary">{viewingDoc?.doc_type}</Badge>
              </div>
            </div>
            {viewingDoc?.url && (
              <div>
                <Label className="text-xs uppercase text-muted-foreground font-bold">ไฟล์แนบ</Label>
                <div className="mt-1">
                  <a 
                    href={viewingDoc.url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-primary hover:underline text-sm flex items-center gap-1"
                  >
                    <Upload className="h-3 w-3" /> {viewingDoc.url.split("/").pop()}
                  </a>
                </div>
              </div>
            )}
            <div>
              <Label className="text-xs uppercase text-muted-foreground font-bold">เนื้อหาที่สอน</Label>
              <div className="mt-1 p-4 rounded-lg bg-card/50 border border-border/40 text-sm whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
                {viewingDoc?.content || "ไม่มีเนื้อหาข้อความ"}
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground text-right">
              สอนเมื่อ: {viewingDoc && new Date(viewingDoc.created_at).toLocaleString('th-TH')}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingDoc(null)}>ปิด</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingDoc} onOpenChange={(open) => !open && setEditingDoc(null)}>
        <DialogContent className="max-w-2xl bg-gradient-card">
          <DialogHeader>
            <DialogTitle>แก้ไขข้อมูลฝึกสอน</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>หัวข้อ</Label>
              <Input
                value={editingDoc?.title || ""}
                onChange={(e) => setEditingDoc({ ...editingDoc, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>เนื้อหา</Label>
              <Textarea
                value={editingDoc?.content || ""}
                onChange={(e) => setEditingDoc({ ...editingDoc, content: e.target.value })}
                rows={8}
              />
            </div>
            {editingDoc?.url && (
              <div className="text-xs text-muted-foreground">
                * ไฟล์แนบเดิม: {editingDoc.url.split("/").pop()} (ไม่สามารถแก้ไขไฟล์ได้ในโหมดนี้)
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDoc(null)}>ยกเลิก</Button>
            <Button onClick={update} className="bg-gradient-primary">บันทึกการแก้ไข</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
