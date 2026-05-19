import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { th } from "./th";
import { en } from "./en";
import { LANGUAGES } from "./languages";

// Build resources: th + en have full translations. The other 18 languages start as
// English copies (full UI works) — translators can override keys later.
const baseResources: Record<string, { translation: any }> = {
  th: { translation: th },
  en: { translation: en },
};
for (const l of LANGUAGES) {
  if (!baseResources[l.code]) baseResources[l.code] = { translation: en };
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: baseResources,
    fallbackLng: "th",
    supportedLngs: LANGUAGES.map((l) => l.code),
    interpolation: { escapeValue: false },
    detection: { order: ["localStorage", "navigator"], caches: ["localStorage"] },
  });

export default i18n;
