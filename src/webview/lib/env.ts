// A pasted or imported .env file as variables. No imports: `node --test`
// loads this file directly.

/** What the API and the shell accept as a variable name. */
export const ENV_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * `KEY=value` per line; blank lines, `#` comments and an `export ` prefix
 * are skipped. A quoted value keeps its quotes, as written: the host's
 * shellQuote leaves one pair of quotes alone, so `"${HOST}:3000"` still
 * refers to HOST, and a quoted value may span lines (a PEM key). An unquoted
 * value ends at ` #`. The last of a repeated key wins. `skipped` lists the
 * 1-based lines that aren't a variable.
 */
export function parseEnv(text: string): {
  vars: [string, string][];
  skipped: number[];
} {
  const vars = new Map<string, string>();
  const skipped: number[] = [];
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? "").trim();
    if (!line || line.startsWith("#")) continue;
    const body = line.replace(/^export\s+/, "");
    const eq = body.indexOf("=");
    const key = eq > 0 ? body.slice(0, eq).trim() : "";
    if (!ENV_KEY.test(key)) {
      skipped.push(i + 1);
      continue;
    }
    let value = body.slice(eq + 1).trimStart();
    const quote = value[0];
    if (quote === '"' || quote === "'") {
      const start = i;
      let end = closing(value, quote);
      // Still open: the value goes on over the next lines.
      while (end < 0 && i + 1 < lines.length) {
        i++;
        value += `\n${lines[i] ?? ""}`;
        end = closing(value, quote);
      }
      const rest = end < 0 ? "x" : value.slice(end + 1).trim();
      // Never closed, or "closed" by a later line's quote with text after
      // it (`A="x` then `B="y"`): only this line is bad, the next count.
      if (rest && !rest.startsWith("#")) {
        skipped.push(start + 1);
        i = start;
        continue;
      }
      value = value.slice(0, end + 1);
    } else {
      value = value.replace(/\s+#.*$/, "").trimEnd();
    }
    vars.delete(key);
    vars.set(key, value);
  }
  return { vars: [...vars], skipped };
}

/** Index of the quote that closes `value[0]`; a `\` escapes inside "...". */
function closing(value: string, quote: string): number {
  for (let j = 1; j < value.length; j++) {
    if (quote === '"' && value[j] === "\\") j++;
    else if (value[j] === quote) return j;
  }
  return -1;
}
