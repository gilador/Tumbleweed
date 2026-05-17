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

interface Run {
  text: string;
  isHeb: boolean;
}

function splitRuns(text: string): Run[] {
  const runs: Run[] = [];
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
  return runs;
}

function reverseHebRuns(runs: Run[]): string[] {
  return runs.map((run) => {
    if (run.isHeb) {
      // Reverse the Hebrew characters
      return [...run.text].reverse().join("");
    }
    return run.text;
  });
}

/**
 * Reverse Hebrew runs in place for jsPDF (which renders L→R with no bidi).
 * Overall run order is preserved — suitable for LTR document flow where
 * Hebrew segments appear inline with Latin/digit content.
 * Fast-path: non-Hebrew strings are returned unchanged.
 */
export function shapeHebrew(text: string): string {
  if (!HEBREW_RANGE.test(text)) return text;
  return reverseHebRuns(splitRuns(text)).join("");
}

/**
 * Process a string for jsPDF RTL rendering.
 * - Reverses the overall character order (since jsPDF renders L→R)
 * - Keeps LTR runs (numbers, Latin) in their original internal order
 */
export function processRtl(text: string): string {
  if (!HEBREW_RANGE.test(text)) return text; // No Hebrew, no processing needed
  // Reverse Hebrew runs internally, then reverse the entire run order
  return reverseHebRuns(splitRuns(text)).reverse().join("");
}
