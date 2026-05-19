import { useTranslation } from "react-i18next";
import { Globe, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { LANGUAGES, type LangCode } from "@/i18n/languages";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";

function resolveCode(lng: string): LangCode {
  const match = LANGUAGES.find((l) => l.code === lng || lng.startsWith(l.code + "-") || lng === l.code);
  return (match?.code as LangCode) ?? "en";
}

export const LanguageSwitcher = ({ compact = false }: { compact?: boolean }) => {
  const { i18n } = useTranslation();
  const current = resolveCode(i18n.language);
  const currentMeta = LANGUAGES.find((l) => l.code === current) ?? LANGUAGES[1];

  useEffect(() => {
    document.body.setAttribute("lang", current);
    document.documentElement.dir = current === "ar" ? "rtl" : "ltr";
  }, [current]);

  const change = async (code: LangCode) => {
    await i18n.changeLanguage(code);
    // Persist to profile if signed in (best-effort, ignore errors)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ locale: code }).eq("id", user.id);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size={compact ? "icon" : "sm"} className="text-muted-foreground hover:text-foreground">
          <Globe className="h-4 w-4" />
          {!compact && (
            <span className="ml-2 font-medium">
              {currentMeta.flag} {currentMeta.code.toUpperCase()}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto w-56">
        {LANGUAGES.map((l) => (
          <DropdownMenuItem key={l.code} onClick={() => change(l.code)} className="cursor-pointer">
            <span className="mr-2">{l.flag}</span>
            <span className="flex-1">{l.native}</span>
            <span className="text-xs text-muted-foreground mr-2">{l.label}</span>
            {current === l.code && <Check className="h-3.5 w-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
