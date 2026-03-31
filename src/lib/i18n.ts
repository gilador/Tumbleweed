import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "../locales/en.json";
import he from "../locales/he.json";

const RTL_LANGUAGES = ["he", "ar"];

function updateDocumentDirection(lng: string) {
  const dir = RTL_LANGUAGES.includes(lng) ? "rtl" : "ltr";
  document.documentElement.setAttribute("dir", dir);
  document.documentElement.setAttribute("lang", lng);
}

function syncLanguageToServer(lng: string) {
  const token = localStorage.getItem("tumbleweed_token");
  if (!token) return; // Not in platform mode or not logged in

  // Fire and forget — don't block UI on this
  fetch(`${import.meta.env.VITE_API_URL || ""}/api/users/me/language`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ language: lng }),
  }).catch(() => {
    // Silently fail — localStorage is the source of truth
  });
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      he: { translation: he },
    },
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "tumbleweed-lang",
      caches: ["localStorage"],
    },
  });

i18n.on("languageChanged", (lng) => {
  updateDocumentDirection(lng);
  syncLanguageToServer(lng);
});

// Set initial direction
updateDocumentDirection(i18n.language);

export default i18n;
