import { useState } from "react";
import { useTranslation } from "react-i18next";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [isHebrew, setIsHebrew] = useState(i18n.language === "he");

  const toggle = () => {
    const next = !isHebrew;
    setIsHebrew(next);
    setTimeout(() => {
      i18n.changeLanguage(next ? "he" : "en");
    }, 500);
  };

  return (
    <button
      onClick={toggle}
      className="relative flex items-center w-12 h-7 rounded-full cursor-pointer transition-colors duration-300"
      style={{ backgroundColor: "#1e293b" }}
      aria-label={isHebrew ? "Switch to English" : "עבור לעברית"}
    >
      <span
        className="absolute top-0.5 flex items-center justify-center w-6 h-6 rounded-full bg-white text-[10px] font-medium text-gray-700 shadow-md transition-all duration-300 ease-in-out"
        style={{
          left: isHebrew ? "calc(100% - 1.625rem)" : "0.125rem",
        }}
      >
        {isHebrew ? "ע" : "EN"}
      </span>
    </button>
  );
}
