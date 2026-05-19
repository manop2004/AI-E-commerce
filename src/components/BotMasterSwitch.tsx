import { useEffect, useState } from "react";
import { Bot, BotOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const BotMasterSwitch = () => {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("bot_enabled")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled) setEnabled(data?.bot_enabled ?? true);
    })();
    // Realtime: react to changes from other tabs
    const ch = supabase
      .channel("profile-bot-" + user.id)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => {
          const next = (payload.new as any)?.bot_enabled;
          if (typeof next === "boolean") setEnabled(next);
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [user]);

  if (!user || enabled === null) return null;

  const onChange = async (v: boolean) => {
    setSaving(true);
    setEnabled(v);
    const { error } = await supabase
      .from("profiles")
      .update({ bot_enabled: v })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      setEnabled(!v);
      toast.error("ไม่สามารถบันทึกการตั้งค่าได้");
      return;
    }
    toast.success(v ? "AI Bot ON — บอทกำลังตอบลูกค้าอัตโนมัติ" : "AI Bot OFF — บอทหยุดตอบแล้ว");
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-border/60 bg-card/60">
      {enabled ? (
        <Bot className="h-4 w-4 text-primary" />
      ) : (
        <BotOff className="h-4 w-4 text-muted-foreground" />
      )}
      <span className="text-xs font-medium hidden sm:inline">AI Bot</span>
      <Badge variant={enabled ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
        {enabled ? "ON" : "OFF"}
      </Badge>
      <Switch checked={enabled} onCheckedChange={onChange} disabled={saving} />
    </div>
  );
};