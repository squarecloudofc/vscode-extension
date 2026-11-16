import type { ComponentChildren } from "preact";

import { cx } from "../lib/cx";
import { Icon } from "./icon";

export type Column<T> = {
  key: string;
  label: ComponentChildren;
  align?: "start" | "end";
  /** IDs, sizes, dates: Fira Mono with tabular figures. */
  mono?: boolean;
  width?: string;
  /** The cell; default `row[key]`. */
  render?: (row: T) => ComponentChildren;
};

export function Table<T>({
  columns,
  rows,
  rowKey,
  empty,
  onRowClick,
  label,
  class: className,
}: {
  columns: readonly Column<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  /** Shown in place of the rows when there are none. */
  empty?: ComponentChildren;
  onRowClick?: (row: T) => void;
  label?: string;
  class?: string;
}) {
  return (
    <div class={cx("table-wrap", className)}>
      <table aria-label={label} class="table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                class={column.align === "end" ? "end" : undefined}
                key={column.key}
                scope="col"
                style={column.width ? { width: column.width } : undefined}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr
                data-clickable={onRowClick ? "" : undefined}
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((column) => (
                  <td
                    class={cx(
                      column.align === "end" && "end",
                      column.mono && "mono",
                    )}
                    key={column.key}
                  >
                    {column.render
                      ? column.render(row)
                      : String(
                          (row as Record<string, unknown>)[column.key] ?? "",
                        )}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td class="table__empty" colSpan={columns.length}>
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export type BarRow = {
  key: string;
  label: ComponentChildren;
  /** What the bar's length is relative to. */
  value: number;
  /** The number on the right, formatted. */
  display: string;
  title?: string;
  /** A hue for the bar (a status class); default the text colour, faint. */
  color?: string;
};

/**
 * A ranked breakdown, as the site's BarList: each row's bar sits behind its
 * label, as long as its share of the largest. With `onSelect` a row is a
 * toggle (a filter), and the `active` one shows an ✕ to clear it.
 */
export function BarList({
  rows,
  label,
  empty,
  active,
  onSelect,
}: {
  rows: readonly BarRow[];
  label: string;
  empty: ComponentChildren;
  active?: string;
  onSelect?: (key: string) => void;
}) {
  if (!rows.length) return <p class="bar-list__empty">{empty}</p>;
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <ul aria-label={label} class="bar-list">
      {rows.map((row) => {
        const on = active === row.key;
        const inner = (
          <>
            <span
              class="bar-list__bar"
              style={{
                width: `${(row.value / max) * 100}%`,
                "--bar": row.color,
              }}
            />
            <span class="bar-list__label">{row.label}</span>
            {on ? <Icon name="x" size={12} /> : null}
            <span class="bar-list__value mono">{row.display}</span>
          </>
        );
        return (
          <li key={row.key}>
            {onSelect ? (
              <button
                aria-pressed={on}
                class="bar-list__row"
                onClick={() => onSelect(row.key)}
                title={row.title}
                type="button"
              >
                {inner}
              </button>
            ) : (
              <div class="bar-list__row" title={row.title}>
                {inner}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
