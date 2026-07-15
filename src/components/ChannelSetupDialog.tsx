import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, ExternalLink } from "lucide-react";

type Provider = "line_oa" | "messenger" | "instagram" | "woocommerce" | "shopee" | "lazada";

export function ChannelSetupDialog({
  open,
  onOpenChange,
  provider,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  provider: Provider | null;
  onSaved?: () => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [config, setConfig] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const FIELDS: Record<Provider, { key: string; label: string; help: string; placeholder?: string }[]> = {
    line_oa: [
      {
        key: "access_token",
        label: "Channel Access Token",
        help: t("channelSetup.line.help1", "หาได้ที่ developers.line.biz → Channel ของคุณ → Messaging API → Channel Access Token (long-lived)"),
        placeholder: "e.g. xXxXxXxXxXxXxXxXxXxX...",
      },
      {
        key: "channel_secret",
        label: "Channel Secret (optional)",
        help: t("channelSetup.line.help2", "ใช้สำหรับ verify signature (แนะนำ)"),
      },
    ],
    messenger: [
      {
        key: "page_access_token",
        label: "Page Access Token",
        help: t("channelSetup.messenger.help1", "Meta App → Messenger → Settings → Generate token จาก Page ของคุณ"),
      },
      {
        key: "verify_token",
        label: "Verify Token",
        help: t("channelSetup.messenger.help2", "ตั้งค่าอะไรก็ได้ ต้องตรงกับที่กรอกใน Meta App webhook subscription"),
        placeholder: t("channelSetup.messenger.placeholder2", "เช่น mysecret123"),
      },
    ],
    instagram: [
      {
        key: "page_access_token",
        label: "Page Access Token",
        help: t("channelSetup.ig.help1", "Instagram Business Account ต้องเชื่อมกับ Facebook Page"),
      },
      { key: "verify_token", label: "Verify Token", help: t("channelSetup.ig.help2", "เหมือน Messenger") },
    ],
    woocommerce: [
      { key: "store_url", label: "Store URL", help: t("channelSetup.woo.help1", "เช่น https://yourshop.com (ไม่ต้องใส่ / ท้าย)"), placeholder: "https://yourshop.com" },
      { key: "consumer_key", label: "Consumer Key", help: t("channelSetup.woo.help2", "WooCommerce → Settings → Advanced → REST API → Add key (Read/Write permission)") },
      { key: "consumer_secret", label: "Consumer Secret", help: t("channelSetup.woo.help3", "ได้พร้อมกับ Consumer Key — เก็บไว้ดีๆ ไม่แสดงอีกหลังสร้าง") },
    ],
    shopee: [
      { key: "shop_id", label: "Shop ID", help: t("channelSetup.shopee.help1", "ดูได้ที่ Seller Centre → Account & Security"), placeholder: t("channelSetup.shopee.placeholder1", "เช่น 123456789") },
      { key: "partner_id", label: "Partner ID", help: t("channelSetup.shopee.help2", "จาก Shopee Open Platform → My Apps") },
      { key: "partner_key", label: "Partner Key", help: t("channelSetup.shopee.help3", "Secret key คู่กับ Partner ID — เก็บไว้ดี ๆ") },
    ],
    lazada: [
      { key: "seller_id", label: "Seller ID", help: t("channelSetup.lazada.help1", "ดูได้ที่ Lazada Seller Center → My Account") },
      { key: "app_key", label: "App Key", help: t("channelSetup.lazada.help2", "จาก Lazada Open Platform → Create App") },
      { key: "app_secret", label: "App Secret", help: t("channelSetup.lazada.help3", "ได้พร้อมกับ App Key") },
    ],
  };

  const TITLES: Record<Provider, string> = {
    line_oa: t("channelSetup.title.line", "ตั้งค่า LINE OA"),
    messenger: t("channelSetup.title.messenger", "ตั้งค่า Facebook Messenger"),
    instagram: t("channelSetup.title.instagram", "ตั้งค่า Instagram DM"),
    woocommerce: t("channelSetup.title.woocommerce", "เชื่อมต่อ WooCommerce"),
    shopee: t("channelSetup.title.shopee", "เชื่อมต่อ Shopee"),
    lazada: t("channelSetup.title.lazada", "เชื่อมต่อ Lazada"),
  };

  useEffect(() => {
    if (!open || !provider || !user) return;
    
    setConfig({});
    
    supabase
      .from("integrations")
      .select("config")
      .eq("user_id", user.id)
      .eq("provider", provider)
      .maybeSingle()
      .then(({ data }) => setConfig((data?.config as any) || {}));
  }, [open, provider, user]);

  if (!provider) return null;

  const fields = FIELDS[provider];
  const projectUrl = import.meta.env.VITE_SUPABASE_URL || "";
  
  const getWebhookFunction = () => {
    if (provider === "line_oa") return "line-webhook";
    if (provider === "messenger" || provider === "instagram") return "meta-webhook";
    return null;
  };
  
  const webhookFunction = getWebhookFunction();
  const webhookUrl = (user && webhookFunction && projectUrl) ? `${projectUrl}/functions/v1/${webhookFunction}?owner=${user.id}` : "";

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t("channelSetup.toast.copied", "คัดลอกสำเร็จ!"));
  };

  const save = async () => {
    if (!user || !provider) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("integrations").upsert(
        {
          user_id: user.id,
          provider: provider as any,
          status: "connected",
          store_name:
            provider === "line_oa" ? "LINE OA"
            : provider === "messenger" ? "Facebook Page"
            : provider === "instagram" ? "Instagram"
            : provider === "woocommerce" ? (config.store_url || "WooCommerce")
            : provider === "shopee" ? "Shopee Shop"
            : provider === "lazada" ? "Lazada Shop"
            : "Channel",
          connected_at: new Date().toISOString(),
          config,
        },
        { onConflict: "user_id,provider" },
      );
      if (error) throw error;
      toast.success(t("channelSetup.toast.success", "บันทึกเรียบร้อย — AI Bot พร้อมตอบลูกค้าแล้ว"));
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || t("channelSetup.toast.error", "เกิดข้อผิดพลาดในการบันทึก"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{TITLES[provider]}</DialogTitle>
          <DialogDescription>{t("channelSetup.desc", "กรอกข้อมูลจาก developer console แล้ว AI Bot จะตอบลูกค้าใน channel นี้อัตโนมัติ")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {webhookUrl && (
            <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
              <Label className="text-primary font-semibold">{t("channelSetup.webhookLabel", "Webhook URL (นำไปใส่ใน Developer Console)")}</Label>
              <div className="flex gap-2 mt-2">
                <Input value={webhookUrl} readOnly className="font-mono text-xs bg-background" />
                <Button variant="outline" size="icon" onClick={() => copy(webhookUrl)} title="Copy URL">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {fields.map((f) => (
            <div key={f.key}>
              <Label>{f.label}</Label>
              <Input
                value={config[f.key] || ""}
                onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="mt-1"
                type={f.key.includes("secret") || f.key.includes("key") || f.key.includes("token") ? "password" : "text"}
              />
              <div className="text-[11px] text-muted-foreground mt-1.5">{f.help}</div>
            </div>
          ))}

          {provider === "line_oa" && (
            <a href="https://developers.line.biz/console" target="_blank" rel="noreferrer" className="text-sm text-primary inline-flex items-center gap-1 hover:underline">
              {t("channelSetup.link.line", "เปิด LINE Developers Console")} <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {(provider === "messenger" || provider === "instagram") && (
            <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="text-sm text-primary inline-flex items-center gap-1 hover:underline">
              {t("channelSetup.link.meta", "เปิด Meta for Developers")} <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {provider === "woocommerce" && (
            <div className="text-xs text-muted-foreground bg-primary/5 p-2 rounded border border-primary/10">
              {t("channelSetup.wooNote1", "💡 สร้าง API Key ที่:")} <code className="bg-background border border-border px-1 rounded">WooCommerce → Settings → Advanced → REST API → Add key</code> {t("channelSetup.wooNote2", "เลือก Permission =")} <b>Read/Write</b> {t("channelSetup.wooNote3", "แล้วคัดลอกมาวางที่นี่")}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("channelSetup.btn.cancel", "ยกเลิก")}
          </Button>
          <Button onClick={save} disabled={saving} className="bg-gradient-primary min-w-[120px]">
            {saving ? t("channelSetup.btn.saving", "กำลังบันทึก...") : t("channelSetup.btn.save", "บันทึกและเชื่อมต่อ")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}