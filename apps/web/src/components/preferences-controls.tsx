import { useTranslation } from "react-i18next";
import { LANGUAGES, type Language } from "@zbeul/core";
import { usePreferences } from "../preferences";

const control =
  "rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Each language named in itself ("English", "français"). */
const nativeName = (language: Language) =>
  new Intl.DisplayNames([language], { type: "language" }).of(language) ??
  language;

/** Shown only when the site offers more than one language. */
export function LanguagePicker({ className = "" }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const setLanguage = usePreferences((state) => state.setLanguage);
  if (LANGUAGES.length < 2) return null;
  return (
    <select
      aria-label={t("preferences.language")}
      value={i18n.resolvedLanguage}
      onChange={(event) => setLanguage(event.target.value as Language)}
      className={`bg-card border border-input px-2 py-1.5 text-sm ${control} ${className}`}
    >
      {LANGUAGES.map((language) => (
        <option key={language} value={language} lang={language}>
          {nativeName(language)}
        </option>
      ))}
    </select>
  );
}
