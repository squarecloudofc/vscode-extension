// ANSI escape codes in log lines → styled segments for <Console>. Ported
// from the site's console (apps/website/src/components/common/console/
// ansi.tsx) with its colours; other escape sequences (cursor moves, line
// clears, OSC links) are dropped instead of printed. No imports:
// `node --test` loads this file directly.

export type AnsiStyle = {
  color?: string;
  background?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
};

export type AnsiSegment = { text: string; style?: AnsiStyle };

// Tailwind's 500s (and 400s/300s for the bright set), as on the site.
const COLORS: Record<number, string> = {
  30: "#3f3f46",
  31: "#ef4444",
  32: "#22c55e",
  33: "#eab308",
  34: "#3b82f6",
  35: "#f43f5e",
  36: "#06b6d4",
  37: "#d4d4d8",
  90: "#71717a",
  91: "#f87171",
  92: "#4ade80",
  93: "#fde047",
  94: "#60a5fa",
  95: "#fb7185",
  96: "#67e8f9",
  97: "#f4f4f5",
  40: "#18181b",
  41: "#b91c1c",
  42: "#15803d",
  43: "#b45309",
  44: "#1d4ed8",
  45: "#be123c",
  46: "#0e7490",
  47: "#d4d4d8",
  100: "#27272a",
  101: "#f87171",
  102: "#4ade80",
  103: "#fde047",
  104: "#60a5fa",
  105: "#fb7185",
  106: "#67e8f9",
  107: "#f4f4f5",
};

// CSI (ESC [ params intermediates final), OSC (ESC ] … BEL / ESC \), or any
// other ESC sequence: intermediates then one final byte, such as a charset
// (ESC ( B), cursor save/restore (ESC 7 / ESC 8) or keypad mode (ESC = / >).
const ESCAPE =
  // biome-ignore lint/suspicious/noControlCharactersInRegex: matching ESC is the point
  /\x1b\[([0-9;?]*)[ -/]*([@-~])|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)?|\x1b[ -/]*[0-~]/g;

function rgb256(n: number): string {
  if (n >= 16 && n < 232) {
    const i = n - 16;
    const steps = [0, 95, 135, 175, 215, 255];
    const r = steps[Math.floor(i / 36)];
    const g = steps[Math.floor((i % 36) / 6)];
    const b = steps[i % 6];
    return `rgb(${r},${g},${b})`;
  }
  const gray = n >= 232 && n < 256 ? 8 + (n - 232) * 10 : 255;
  return `rgb(${gray},${gray},${gray})`;
}

/** Applies one SGR parameter list (`1;31`) to `style`, in place. */
function applySgr(params: string, style: AnsiStyle): void {
  const codes = (params || "0").split(";").map(Number);
  for (let j = 0; j < codes.length; j++) {
    const code = codes[j] ?? 0;
    if (code === 0) {
      for (const key of Object.keys(style))
        delete style[key as keyof AnsiStyle];
    } else if (code === 1) style.bold = true;
    else if (code === 2) style.dim = true;
    else if (code === 3) style.italic = true;
    else if (code === 4) style.underline = true;
    else if (code === 9) style.strike = true;
    else if (code === 22) {
      delete style.bold;
      delete style.dim;
    } else if (code === 23) delete style.italic;
    else if (code === 24) delete style.underline;
    else if (code === 29) delete style.strike;
    else if (code === 39) delete style.color;
    else if (code === 49) delete style.background;
    else if (COLORS[code]) {
      const bg = (code >= 40 && code <= 47) || code >= 100;
      if (bg) style.background = COLORS[code];
      else style.color = COLORS[code];
    } else if (code === 38 || code === 48) {
      const key = code === 38 ? "color" : "background";
      const mode = codes[j + 1];
      if (mode === 5 && codes[j + 2] !== undefined) {
        const n = codes[j + 2] as number;
        // 0–15 are the 4-bit palette.
        const base = n < 8 ? 30 + n : 90 + (n - 8);
        style[key] =
          n < 16 ? COLORS[code === 38 ? base : base + 10] : rgb256(n);
        j += 2;
      } else if (mode === 2 && codes[j + 4] !== undefined) {
        style[key] = `rgb(${codes[j + 2]},${codes[j + 3]},${codes[j + 4]})`;
        j += 4;
      }
    }
  }
}

/** The line's text in runs of one style each; a plain line is one segment. */
export function parseAnsi(text: string): AnsiSegment[] {
  if (!text.includes("\x1b")) return text ? [{ text }] : [];
  const out: AnsiSegment[] = [];
  const style: AnsiStyle = {};
  let last = 0;
  const push = (chunk: string) => {
    if (!chunk) return;
    out.push(
      Object.keys(style).length
        ? { text: chunk, style: { ...style } }
        : { text: chunk },
    );
  };
  for (const match of text.matchAll(ESCAPE)) {
    push(text.slice(last, match.index));
    if (match[2] === "m") applySgr(match[1] ?? "", style);
    last = (match.index ?? 0) + match[0].length;
  }
  push(text.slice(last));
  return out;
}

/** What the reader sees of a line: the text without its escape codes. */
export const plainText = (text: string) => text.replace(ESCAPE, "");

/** Log search: case-insensitive, on the visible text. Empty matches all. */
export function matchesLog(text: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  return !q || plainText(text).toLowerCase().includes(q);
}
