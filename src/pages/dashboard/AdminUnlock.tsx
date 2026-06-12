import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Shield, Loader2 } from "lucide-react";

export default function AdminUnlock() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-unlock", { body: { code } });
      if (error || (data as any)?.error) {
        toast.error("รหัสไม่ถูกต้องหรือหมดอายุ");
      } else {
        toast.success("ปลดล็อค Admin สำเร็จ — กำลังโหลดใหม่");
        setTimeout(() => { window.location.href = "/dashboard/admin"; }, 600);
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-md mx-auto mt-12 animate-fade-in">
      <Card className="p-8 bg-gradient-card border-border/50">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-lg bg-gradient-primary grid place-items-center shadow-glow">
            <Shield className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">เข้าสู่ Admin</h1>
            <p className="text-sm text-muted-foreground">ใส่รหัสผู้ดูแลระบบเพื่อปลดล็อค</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="code">รหัส Admin</Label>
            <Input id="code" type="password" autoComplete="off" value={code}
              onChange={(e) => setCode(e.target.value)} placeholder="••••••••" />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-gradient-primary">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "ปลดล็อค"}
          </Button>
          <p className="text-xs text-muted-foreground">รหัสถูกตรวจสอบฝั่งเซิร์ฟเวอร์ ไม่ถูกเก็บใน browser</p>
        </form>
      </Card>
    </div>
  );
}