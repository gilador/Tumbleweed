/**
 * jsPDF doesn't support RTL text natively — it renders characters left-to-right.
 * This utility reverses Hebrew/Arabic text segments while keeping
 * LTR segments (numbers, Latin, punctuation) in the correct visual order.
 */

// Hebrew Unicode range: U+0590–U+05FF, U+FB1D–U+FB4F
const HEBREW_RANGE = /[\u0590-\u05FF\uFB1D-\uFB4F]/;

function isHebrew(char: string): boolean {
  return HEBREW_RANGE.test(char);
}

/**
 * Process a string for jsPDF RTL rendering.
 * - Reverses the overall character order (since jsPDF renders L→R)
 * - Keeps LTR runs (numbers, Latin) in their original internal order
 */
export function processRtl(text: string): string {
  if (!HEBREW_RANGE.test(text)) return text; // No Hebrew, no processing needed

  // Split text into runs of Hebrew vs non-Hebrew characters
  const runs: { text: string; isHeb: boolean }[] = [];
  let currentRun = "";
  let currentIsHeb = false;

  for (const char of text) {
    const charIsHeb = isHebrew(char);
    if (currentRun === "") {
      currentIsHeb = charIsHeb;
      currentRun = char;
    } else if (charIsHeb === currentIsHeb) {
      currentRun += char;
    } else {
      // Spaces adjacent to Hebrew should stay with Hebrew run
      runs.push({ text: currentRun, isHeb: currentIsHeb });
      currentIsHeb = charIsHeb;
      currentRun = char;
    }
  }
  if (currentRun) {
    runs.push({ text: currentRun, isHeb: currentIsHeb });
  }

  // Reverse Hebrew runs internally, then reverse the entire run order
  const processedRuns = runs.map((run) => {
    if (run.isHeb) {
      // Reverse the Hebrew characters
      return [...run.text].reverse().join("");
    }
    return run.text;
  });

  // Reverse run order for RTL visual layout
  return processedRuns.reverse().join("");
}
