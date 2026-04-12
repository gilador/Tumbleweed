import type { jsPDF } from "jspdf";

let fontData: { regular: string; bold: string } | null = null;

export async function registerFonts(doc: jsPDF): Promise<void> {
  // Load font data once (lazy), then register on every new doc instance
  if (!fontData) {
    const module = await import("./fonts/notoSans");
    fontData = { regular: module.notoSansRegular, bold: module.notoSansBold };
  }

  doc.addFileToVFS("NotoSans-Regular.ttf", fontData.regular);
  doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");

  doc.addFileToVFS("NotoSans-Bold.ttf", fontData.bold);
  doc.addFont("NotoSans-Bold.ttf", "NotoSans", "bold");

  doc.setFont("NotoSans");
}
