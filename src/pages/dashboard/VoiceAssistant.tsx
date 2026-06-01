import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2, ShoppingBag, PhoneCall, Sparkles } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeech";
import { toast } from "sonner";

type RankedItem = {
  id: string;
  name: string;
  price: number;
  stock: number;
  image_url: string | null;
  category: string | null;
  reason: string;
};

export default function VoiceAssistant() {
  const { user } = useAuth();
  const speech = useSpeechRecognition("th-TH");
  const [productCount, setProductCount] = useState(0);
  const [suggested, setSuggested] = useState<RankedItem[]>([]);
  const [searching, setSearching] = useState(false);
  const lastQueryRef = useRef("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .gt("stock", 0)
      .then(({ count }) => setProductCount(count || 0));
  }, [user]);

  useEffect(() => {
    const t = speech.transcript.trim();
    if (!user || !t || t.length < 4 || productCount === 0) return;
    // Trim to last ~120 chars (the latest customer utterance) for relevance.
    const tail = t.slice(-200);
    if (tail === lastQueryRef.current) return;
    const handle = setTimeout(async () => {
      lastQueryRef.current = tail;
      setSearching(true);
      try {
        const { data, error } = await supabase.functions.invoke("voice-recommend", {
          body: { ownerId: user.id, transcript: tail },
        });
        if (error) throw error;
        setSuggested((data as any)?.items || []);
      } catch (e: any) {
        console.error("voice-recommend failed", e);
      } finally {
        setSearching(false);
      }
    }, 1200);
    return () => clearTimeout(handle);
  }, [speech.transcript, user, productCount]);

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
              <span className="text-xs text-muted-foreground">สินค้าในสต็อก {productCount} รายการ</span>
              {speech.transcript && (
                <Button size="sm" variant="ghost" onClick={() => { speech.reset(); setSuggested([]); lastQueryRef.current = ""; }}>
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
              <div>• พูดเป็นภาษาไทยใกล้ไมค์ — AI จะวิเคราะห์ความต้องการลูกค้าและแนะนำสินค้าจากสต็อกให้ทันที</div>
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
            {productCount === 0
              ? "ยังไม่มีสินค้าในสต็อก — ไปที่หน้า “สินค้าของร้าน” แล้วนำเข้าไฟล์ CSV/XLSX ก่อน"
              : speech.transcript.trim().length >= 4
              ? "ยังไม่พบสินค้าที่ตรงกับคำพูดนี้ — ลองพูดชื่อสินค้า หมวดหมู่ หรือ SKU ให้ชัดขึ้น"
              : speech.listening
              ? "พูดชื่อสินค้า หมวดหมู่ หรือสิ่งที่ลูกค้าถาม แล้ว AI จะแนะนำให้อัตโนมัติ"
              : "กดปุ่ม “เริ่มฟังสายโทร” แล้วเริ่มคุยกับลูกค้า"}
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {suggested.map((p) => (
              <Card key={p.id} className="p-3 bg-gradient-card border-border/50 hover:border-primary/50 hover:shadow-glow transition">
                <div className="aspect-square rounded-md bg-muted overflow-hidden mb-2 grid place-items-center">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="text-sm font-semibold line-clamp-2">{p.name}</div>
                <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{p.reason}</div>
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