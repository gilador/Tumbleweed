import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRecoilValue } from "recoil";
import { IconShare, IconPrinter, IconCopy, IconBrandWhatsapp } from "@tabler/icons-react";
import html2canvas from "html2canvas";
import type { UniqueString, UserShiftData } from "../models";
import { generateTextSummary } from "../service/textSummary";
import { shiftState, getActiveRosterFromState } from "../stores/shiftStore";

interface ShareButtonProps {
  posts: UniqueString[];
  hours: UniqueString[];
  assignments: (string | null)[][];
  userShiftData: UserShiftData[];
  endTime: string;
  customCellDisplayNames: { [slotKey: string]: string };
  groupBy: "time" | "post";
  onCopied?: () => void;
  disabled?: boolean;
}

// Only use native share on mobile — on desktop the native sheet is limited (no print/save PDF)
const isMobile = typeof window !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const canNativeShare = isMobile && typeof navigator !== "undefined" && typeof navigator.share === "function";

export function ShareButton({
  posts,
  hours,
  assignments,
  userShiftData,
  endTime,
  customCellDisplayNames,
  groupBy,
  onCopied,
  disabled,
}: ShareButtonProps) {
  const { t, i18n } = useTranslation();
  const state = useRecoilValue(shiftState);
  const activeRoster = getActiveRosterFromState(state);
  const scheduleMode = activeRoster.scheduleMode;
  const startDate = activeRoster.startDate;
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getSummary = () =>
    generateTextSummary({
      posts,
      hours,
      assignments,
      userShiftData,
      endTime,
      customCellDisplayNames,
      groupBy,
      scheduleMode,
      startDate,
      locale: i18n.language === "he" ? "he-IL" : "en-US",
    });

  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title: t("shiftSchedule"),
        text: getSummary(),
      });
    } catch {
      // User cancelled or share failed — ignore
    }
  };

  const handlePrint = () => {
    setDropdownOpen(false);
    window.print();
  };

  const hidePrintEl = (el: HTMLElement) => {
    el.classList.add("print-only");
    el.style.display = "";
    el.style.position = "";
    el.style.left = "";
    el.style.top = "";
    el.style.background = "";
    el.style.width = "";
  };

  const handleCopy = async () => {
    setDropdownOpen(false);
    const printEl = document.getElementById("print-view");
    if (!printEl) return;

    // Temporarily show the print view off-screen for capture
    // Must remove the class because .print-only uses display:none !important
    printEl.classList.remove("print-only");
    printEl.style.display = "block";
    printEl.style.position = "absolute";
    printEl.style.left = "-9999px";
    printEl.style.top = "0";
    printEl.style.width = "1100px";
    printEl.style.background = "white";

    try {
      const canvas = await html2canvas(printEl, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });

      hidePrintEl(printEl);

      // Convert canvas to blob synchronously-ish via toBlob
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
          "image/png"
        )
      );

      // Try writing image to clipboard
      const item = new ClipboardItem({ "image/png": blob });
      await navigator.clipboard.write([item]);
      onCopied?.();
    } catch (err: unknown) {
      hidePrintEl(printEl);
      console.error("[ShareButton] Image clipboard failed:", err);
      // Instead of silently falling back to text, show what happened
      // and still copy text as fallback
      try {
        await navigator.clipboard.writeText(getSummary());
        onCopied?.();
      } catch {
        // Clipboard completely failed
      }
    }
  };

  const handleWhatsApp = () => {
    setDropdownOpen(false);
    const text = encodeURIComponent(getSummary());
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  if (canNativeShare) {
    return (
      <button
        onClick={handleNativeShare}
        disabled={disabled}
        className="h-8 w-8 rounded-md hover:bg-accent flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none"
        title={t("shareSchedule")}
      >
        <IconShare size={16} className="text-muted-foreground" />
      </button>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        disabled={disabled}
        className="h-8 w-8 rounded-md hover:bg-accent flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none"
        title={t("shareSchedule")}
      >
        <IconShare size={16} className="text-muted-foreground" />
      </button>
      {dropdownOpen && (
        <div className="absolute start-0 top-full mt-1 z-50 bg-white border border-border rounded-md shadow-lg py-1 min-w-[180px]">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-end"
          >
            <IconPrinter size={16} />
            <span>{t("printSavePdf")}</span>
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-end"
          >
            <IconCopy size={16} />
            <span>{t("copyToClipboard")}</span>
          </button>
          <button
            onClick={handleWhatsApp}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-end"
          >
            <IconBrandWhatsapp size={16} />
            <span>{t("shareOnWhatsApp")}</span>
          </button>
        </div>
      )}
    </div>
  );
}
