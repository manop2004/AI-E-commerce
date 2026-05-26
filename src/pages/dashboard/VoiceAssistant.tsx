import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2, ShoppingBag, PhoneCall, Sparkles } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeech";
import { toast } from "sonner";

type VoiceProduct = {
  id: string;
  name: string;
  price: number;
  stock: number;
  image_url: string | null;
  category: string | null;
  description: string | null;
  sku: string | null;
};

type RankedProduct = { product: VoiceProduct; score: number; reason: string };

const stopWords = new Set(["ครับ", "ค่ะ", "คะ", "มี", "ไหม", "มั้ย", "ราคา", "อยาก", "ต้องการ", "สนใจ", "ขอ", "หน่อย", "ตัว", "แบบ", "สินค้า", "ของ", "ให้", "หา", "เอา", "ดู", "ซื้อ", "ขาย", "แนะนำ", "ลูกค้า", "แล้ว", "หน่อยครับ", "หน่อยค่ะ"]);
const normalize = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const compact = (text: string) => normalize(text).replace(/\s/g, "");
const extractTerms = (text: string) => normalize(text).split(" ").filter((w) => w.length >= 2 && !stopWords.has(w)).slice(-16);
const productTerms = (p: VoiceProduct) => extractTerms([p.name, p.category, p.sku].filter(Boolean).join(" ")).filter((term) => term.length >= 3);

const scoreProduct = (product: VoiceProduct, transcript: string) => {
  const text = normalize(transcript);
  const compactText = compact(transcript);
  const fields = normalize([product.name, product.category, product.description, product.sku].filter(Boolean).join(" "));
  const compactFields = compact(fields);
  const productName = normalize(product.name);
  const compactName = compact(product.name);
  const compactCategory = compact(product.category || "");
  let score = 0;
  const reasons: string[] = [];

  if (product.sku && compactText.includes(compact(product.sku))) { score += 120; reasons.push("ตรงรหัสสินค้า"); }
  if (compactName.length >= 4 && compactText.includes(compactName)) { score += 100; reasons.push("ตรงชื่อสินค้า"); }
  if (compactCategory.length >= 3 && compactText.includes(compactCategory)) { score += 38; reasons.push(`ตรงหมวด ${product.category}`); }

  extractTerms(transcript).forEach((term) => {
    const compactTerm = compact(term);
    if (productName.includes(term) || compactName.includes(compactTerm)) { score += Math.min(34, term.length * 5); reasons.push(`พบคำว่า “${term}” ในชื่อ`); }
    else if (fields.includes(term) || compactFields.includes(compactTerm)) { score += Math.min(18, term.length * 3); }
  });
  productTerms(product).forEach((term) => {
    if (text.includes(term) || compactText.includes(compact(term))) score += 12;
  });
  if (/(ถูก|ประหยัด|ไม่แพง|งบ|budget)/i.test(transcript)) score += Math.max(0, 12 - Number(product.price) / 1000);
  if (/(พร้อมส่ง|มีของ|ด่วน|วันนี้)/i.test(transcript)) score += Math.min(16, product.stock);
  return { score, reason: reasons[0] || "ตรงกับคำที่ลูกค้าพูด" };
};

export default function VoiceAssistant() {
  const { user } = useAuth();
  const speech = useSpeechRecognition("th-TH");
  const [products, setProducts] = useState<VoiceProduct[]>([]);
  const [suggested, setSuggested] = useState<RankedProduct[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("products")
      .select("id,name,price,stock,image_url,category,description,sku")
      .eq("status", "active")
      .gt("stock", 0)
      .order("updated_at", { ascending: false })
      .limit(500)
      .then(({ data }) => setProducts((data as VoiceProduct[]) || []));
  }, [user]);

  useEffect(() => {
    const t = speech.transcript.trim();
    if (!user || !t || t.length < 3 || products.length === 0) return;
    const handle = setTimeout(() => {
      setSearching(true);
      const ranked = products
        .map((p) => ({ product: p, ...scoreProduct(p, t) }))
        .filter((x) => x.score >= 36)
        .sort((a, b) => b.score - a.score || b.product.stock - a.product.stock)
        .slice(0, 6);
      setSuggested(ranked);
      setSearching(false);
    }, 300);
    return () => clearTimeout(handle);
  }, [speech.transcript, user, products]);

  const copyPitch = (p: any) => {
    const text = `${p.name} ราคา ${Number(p.price).toLocaleString()} บาท (คงเหลือ ${p.stock} ชิ้น)`;
    navigator.clipboard.writeText(text);
    toast.success("คัดลอกข้อความขายแล้ว");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <PhoneCall className="h-7 w-7 text-primary" /> Voice AI ผู้ช่วยตอนโทร
        </h1>
        <p className="text-muted-foreground mt-1">
          เปิดไมค์ตอนคุยโทรศัพท์กับลูกค้า — AI จะจับคำพูดและค้นหาสินค้าในสต็อกมาแนะนำให้ทันที
        </p>
      </div>

      <Card className="p-6 bg-gradient-card border-border/50">
        {!speech.supported ? (
          <div className="text-sm text-destructive">
            เบราว์เซอร์นี้ไม่รองรับ Web Speech API — กรุณาเปิดด้วย Chrome / Edge บนเดสก์ท็อป หรือ Safari บน iOS
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Button
                size="lg"
                variant={speech.listening ? "destructive" : "default"}
                className={!speech.listening ? "bg-gradient-primary" : ""}
                onClick={() => {
                  if (speech.listening) speech.stop();
                  else { speech.reset(); setSuggested([]); speech.start(); }
                }}
              >
                {speech.listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                {speech.listening ? "หยุดฟัง" : "เริ่มฟังสายโทร"}
              </Button>
              {speech.listening && (
                <span className="text-sm text-destructive flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" /> กำลังฟัง...
                </span>
              )}
              <span className="text-xs text-muted-foreground">{speech.status}</span>
              {searching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <span className="text-xs text-muted-foreground">สินค้าในสต็อก {products.length} รายการ</span>
              {speech.transcript && (
                <Button size="sm" variant="ghost" onClick={() => { speech.reset(); setSuggested([]); }}>
                  ล้างข้อความ
                </Button>
              )}
            </div>

            {speech.transcript && (
              <div className="mt-4 p-3 rounded-lg bg-background/60 border border-border/50">
                <div className="text-xs text-muted-foreground mb-1">คำพูดที่จับได้</div>
                <div className="text-sm italic">"{speech.transcript}"</div>
              </div>
            )}
            {speech.error && (
              <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/40 text-sm text-destructive">
                {speech.error}
              </div>
            )}
            <div className="mt-4 text-xs text-muted-foreground space-y-1">
              <div>• ต้องเปิดผ่าน HTTPS และใช้ Chrome / Edge (Safari iOS รองรับบางส่วน)</div>
              <div>• อนุญาตไมโครโฟนเมื่อเบราว์เซอร์ถาม — ถ้ากดปฏิเสธไปแล้ว ให้กดไอคอน 🔒 ที่ URL แล้วเปลี่ยนเป็น Allow</div>
              <div>• พูดเป็นภาษาไทยใกล้ไมค์ ระบบจะค้นหาสินค้าในสต็อกอัตโนมัติ</div>
            </div>
          </>
        )}
      </Card>

      <div>
        <h2 className="font-display text-lg font-semibold mb-3 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" /> สินค้าที่ AI แนะนำให้ขาย
        </h2>
        {suggested.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground bg-gradient-card border-border/50 border-dashed">
            {products.length === 0
              ? "ยังไม่มีสินค้าในสต็อก — ไปที่หน้า “สินค้าของร้าน” แล้วนำเข้าไฟล์ CSV/XLSX ก่อน"
              : speech.listening
              ? "พูดชื่อสินค้า หมวดหมู่ หรือสิ่งที่ลูกค้าถาม แล้ว AI จะแนะนำให้อัตโนมัติ"
              : "กดปุ่ม “เริ่มฟังสายโทร” แล้วเริ่มคุยกับลูกค้า"}
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {suggested.map(({ product: p, reason }) => (
              <Card key={p.id} className="p-3 bg-gradient-card border-border/50 hover:border-primary/50 hover:shadow-glow transition">
                <div className="aspect-square rounded-md bg-muted overflow-hidden mb-2 grid place-items-center">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="text-sm font-semibold line-clamp-2">{p.name}</div>
                <div className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{reason}</div>
                <div className="text-primary font-bold mt-1">฿{Number(p.price).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mb-2">คงเหลือ {p.stock} ชิ้น</div>
                <Button size="sm" variant="outline" className="w-full" onClick={() => copyPitch(p)}>
                  คัดลอกบทพูด
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}