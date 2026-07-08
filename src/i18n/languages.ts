// 20 supported languages. Sparse translations fall back to English via i18next fallbackLng.
export type LangCode =
  | "th" | "en" | "zh" | "zh-TW" | "ja" | "ko" | "vi" | "id" | "ms" | "tl"
  | "hi" | "ar" | "es" | "pt" | "fr" | "de" | "ru" | "it" | "tr" | "nl";

export const LANGUAGES: { code: LangCode; label: string; native: string; flag: string }[] = [
  { code: "th",    label: "Thai",                native: "ไทย",        flag: "🇹🇭" },
  { code: "en",    label: "English",             native: "English",    flag: "🇬🇧" },
  { code: "zh", label: "Chinese", native: "中文", flag: "🇨🇳" },
  { code: "zh-TW", label: "Chinese (Traditional)",native: "繁體中文",   flag: "🇹🇼" },
  { code: "ja",    label: "Japanese",            native: "日本語",      flag: "🇯🇵" },
  { code: "ko",    label: "Korean",              native: "한국어",      flag: "🇰🇷" },
  { code: "vi",    label: "Vietnamese",          native: "Tiếng Việt", flag: "🇻🇳" },
  { code: "id",    label: "Indonesian",          native: "Bahasa Indonesia", flag: "🇮🇩" },
  { code: "ms",    label: "Malay",               native: "Bahasa Melayu", flag: "🇲🇾" },
  { code: "tl",    label: "Filipino",            native: "Filipino",   flag: "🇵🇭" },
  { code: "hi",    label: "Hindi",               native: "हिन्दी",       flag: "🇮🇳" },
  { code: "ar",    label: "Arabic",              native: "العربية",     flag: "🇸🇦" },
  { code: "es",    label: "Spanish",             native: "Español",    flag: "🇪🇸" },
  { code: "pt",    label: "Portuguese",          native: "Português",  flag: "🇵🇹" },
  { code: "fr",    label: "French",              native: "Français",   flag: "🇫🇷" },
  { code: "de",    label: "German",              native: "Deutsch",    flag: "🇩🇪" },
  { code: "ru",    label: "Russian",             native: "Русский",    flag: "🇷🇺" },
  { code: "it",    label: "Italian",             native: "Italiano",   flag: "🇮🇹" },
  { code: "tr",    label: "Turkish",             native: "Türkçe",     flag: "🇹🇷" },
  { code: "nl",    label: "Dutch",               native: "Nederlands", flag: "🇳🇱" },
];

export const LANGUAGE_NAMES: Record<LangCode, string> = LANGUAGES.reduce(
  (acc, l) => ({ ...acc, [l.code]: l.label }),
  {} as Record<LangCode, string>,
);