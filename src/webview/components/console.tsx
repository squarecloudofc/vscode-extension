import { Component, type ComponentChildren, type JSX } from "preact";
import { useLayoutEffect, useRef } from "preact/hooks";

import { type AnsiSegment, parseAnsi } from "../lib/ansi";
import { cx } from "../lib/cx";

export type ConsoleLine = {
  id: string | number;
  text: string;
  /** Already formatted for the reader's locale. */
  time?: string;
  stderr?: boolean;
};

function styleOf(segment: AnsiSegment): JSX.CSSProperties | undefined {
  const s = segment.style;
  if (!s) return undefined;
  const decoration = [s.underline && "underline", s.strike && "line-through"]
    .filter(Boolean)
    .join(" ");
  return {
    color: s.color,
    backgroundColor: s.background,
    fontWeight: s.bold ? "500" : undefined,
    fontStyle: s.italic ? "italic" : undefined,
    opacity: s.dim ? 0.7 : undefined,
    textDecorationLine: decoration || undefined,
  };
}

// Lines never change once written: a new batch renders only the new ones.
class Line extends Component<{ line: ConsoleLine }> {
  shouldComponentUpdate(next: { line: ConsoleLine }) {
    return next.line !== this.props.line;
  }

  render() {
    const { line } = this.props;
    return (
      <div class={cx("console__line", line.stderr && "console__line--err")}>
        {line.time ? <span class="console__time">{line.time}</span> : null}
        <span class="console__text">
          {parseAnsi(line.text).map((segment, index) =>
            segment.style ? (
              <span key={index} style={styleOf(segment)}>
                {segment.text}
              </span>
            ) : (
              segment.text
            ),
          )}
        </span>
      </div>
    );
  }
}

/**
 * Log lines with their ANSI colours, a muted time column and stderr on a
 * faint red wash. Follows new lines while scrolled to the bottom and stays
 * put once the reader scrolls up.
 */
export function Console({
  lines,
  empty,
  height = 360,
  label,
  class: className,
}: {
  lines: readonly ConsoleLine[];
  /** Shown while there are no lines. */
  empty?: ComponentChildren;
  height?: number | string;
  label: string;
  class?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <div
      aria-label={label}
      aria-live="off"
      class={cx("console", className)}
      onScroll={(event) => {
        const el = event.currentTarget;
        atBottom.current =
          el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
      }}
      ref={ref}
      role="log"
      style={{ maxHeight: typeof height === "number" ? `${height}px` : height }}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable log must be reachable by keyboard
      tabIndex={0}
    >
      {lines.length ? (
        lines.map((line) => <Line key={line.id} line={line} />)
      ) : (
        <div class="console__empty">{empty}</div>
      )}
    </div>
  );
}
