import {
  type ComponentChildren,
  cloneElement,
  type JSX,
  type VNode,
} from "preact";
import { useEffect, useId, useRef, useState } from "preact/hooks";

import type { IconName } from "../icons";
import { cx } from "../lib/cx";
import { Button, IconButton } from "./button";
import { Input } from "./form";
import { Icon } from "./icon";

// Overlays use the platform: the Popover API (top layer, light dismiss, Esc)
// for tooltips and menus, and <dialog> (focus trap, Esc, backdrop) for
// dialogs. Only the placement next to the trigger is ours.

const isOpen = (el: HTMLElement) => el.matches(":popover-open");

/**
 * A label on hover and keyboard focus, above the trigger (below when there
 * is no room). `describe={false}` when the trigger already carries the same
 * text as its name (an IconButton), so it isn't read twice.
 */
export function Tooltip({
  content,
  describe = true,
  children,
}: {
  content: ComponentChildren;
  describe?: boolean;
  children: VNode<any>;
}) {
  const id = useId();
  const tip = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLSpanElement>(null);

  const show = () => {
    const el = tip.current;
    const target = anchor.current?.firstElementChild;
    if (!el || !target || isOpen(el)) return;
    el.showPopover();
    const r = target.getBoundingClientRect();
    const above = r.top - el.offsetHeight - 6;
    el.style.top = `${above < 4 ? r.bottom + 6 : above}px`;
    el.style.left = `${Math.min(
      Math.max(4, r.left + r.width / 2 - el.offsetWidth / 2),
      document.documentElement.clientWidth - el.offsetWidth - 4,
    )}px`;
  };
  const hide = () => {
    if (tip.current && isOpen(tip.current)) tip.current.hidePopover();
  };
  // Keyboard focus only, and a frame later: focus also lands here when a
  // menu closes and hands it back, in the middle of that popover's own
  // toggle, where showing another popover throws.
  const showOnFocus = (event: FocusEvent) => {
    if (!(event.target as Element).matches(":focus-visible")) return;
    requestAnimationFrame(() => {
      if (anchor.current?.contains(document.activeElement)) show();
    });
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: mirrors hover and focus of the control inside
    <span
      class="tooltip-anchor"
      onFocusIn={showOnFocus}
      onFocusOut={hide}
      onKeyDown={(event) => event.key === "Escape" && hide()}
      onPointerDown={hide}
      onPointerEnter={show}
      onPointerLeave={hide}
      ref={anchor}
    >
      {describe ? cloneElement(children, { "aria-describedby": id }) : children}
      <div
        aria-hidden={describe ? undefined : "true"}
        class="tooltip"
        id={id}
        popover="manual"
        ref={tip}
        role="tooltip"
      >
        {content}
      </div>
    </span>
  );
}

export type MenuEntry =
  | {
      label: string;
      icon?: IconName;
      onSelect: () => void;
      danger?: boolean;
      disabled?: boolean;
    }
  | { group: string }
  | "separator";

/**
 * An overflow menu: the ⋯ button (or a text button, `text`) and its items,
 * grouped by optional headings. Arrow keys, Home and End move between items.
 */
export function Menu({
  items,
  label,
  icon = "dots-three",
  text,
  align = "end",
}: {
  items: readonly MenuEntry[];
  /** The trigger's accessible name. */
  label: string;
  icon?: IconName;
  /** A visible text trigger with a caret (a picker) instead of the icon. */
  text?: ComponentChildren;
  align?: "start" | "end";
}) {
  const id = useId();
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = menu.current;
    if (!el) return;
    const trigger = () =>
      document.querySelector<HTMLElement>(
        `[popovertarget="${CSS.escape(id)}"]`,
      );
    // Placed before it shows, so it never flashes at the default spot.
    const before = (event: Event) => {
      const r = trigger()?.getBoundingClientRect();
      if ((event as ToggleEvent).newState !== "open" || !r) return;
      el.style.top = `${r.bottom + 4}px`;
      el.style.left = align === "start" ? `${r.left}px` : "auto";
      el.style.right =
        align === "end"
          ? `${document.documentElement.clientWidth - r.right}px`
          : "auto";
    };
    const toggle = (event: Event) => {
      const opened = (event as ToggleEvent).newState === "open";
      setOpen(opened);
      if (!opened) return;
      const r = trigger()?.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      // No room below: open upward.
      if (r && box.bottom > window.innerHeight - 8)
        el.style.top = `${Math.max(8, r.top - box.height - 4)}px`;
      el.querySelector<HTMLElement>(".menu__item:not(:disabled)")?.focus();
    };
    el.addEventListener("beforetoggle", before);
    el.addEventListener("toggle", toggle);
    return () => {
      el.removeEventListener("beforetoggle", before);
      el.removeEventListener("toggle", toggle);
    };
  }, [id, align]);

  const onKeyDown = (event: JSX.TargetedKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") {
      menu.current?.hidePopover();
      return;
    }
    const all = [
      ...event.currentTarget.querySelectorAll<HTMLElement>(
        ".menu__item:not(:disabled)",
      ),
    ];
    const at = all.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === "ArrowDown"
        ? all[(at + 1) % all.length]
        : event.key === "ArrowUp"
          ? all[(at - 1 + all.length) % all.length]
          : event.key === "Home"
            ? all[0]
            : event.key === "End"
              ? all.at(-1)
              : undefined;
    if (!next) return;
    event.preventDefault();
    next.focus();
  };

  const triggerProps = {
    "aria-expanded": open,
    "aria-haspopup": "menu" as const,
    popovertarget: id,
  };

  return (
    <>
      {text ? (
        <Button {...triggerProps} size="xs" variant="ghost">
          {text}
          <Icon name="caret-down" />
        </Button>
      ) : (
        <IconButton {...triggerProps} icon={icon} label={label} />
      )}
      <div
        aria-label={label}
        class="menu"
        id={id}
        onKeyDown={onKeyDown}
        popover="auto"
        ref={menu}
        role="menu"
      >
        {items.map((entry, index) =>
          entry === "separator" ? (
            <hr class="menu__separator" key={index} />
          ) : "group" in entry ? (
            <div class="menu__group label" key={index} role="presentation">
              {entry.group}
            </div>
          ) : (
            <button
              class={cx("menu__item", entry.danger && "menu__item--danger")}
              disabled={entry.disabled}
              key={index}
              onClick={() => {
                menu.current?.hidePopover();
                entry.onSelect();
              }}
              role="menuitem"
              tabIndex={-1}
              type="button"
            >
              {entry.icon ? <Icon name={entry.icon} /> : null}
              {entry.label}
            </button>
          ),
        )}
      </div>
    </>
  );
}

/**
 * A modal confirmation. With `confirmText` (a resource's name) the confirm
 * button stays off until that text is typed: the guard for deletes.
 */
export function Dialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  danger = false,
  confirmText,
  confirmPrompt,
  busy,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: ComponentChildren;
  description?: ComponentChildren;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  /** What must be typed to confirm. */
  confirmText?: string;
  /** The line above that field, e.g. "Type my-bot to confirm". */
  confirmPrompt?: ComponentChildren;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ComponentChildren;
}) {
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setTyped("");
      dialog.showModal();
    } else if (!open && dialog.open) dialog.close();
  }, [open]);

  const matches = confirmText === undefined || typed.trim() === confirmText;

  return (
    <dialog
      aria-labelledby={`${id}-title`}
      class="dialog"
      onClose={onClose}
      ref={ref}
    >
      <form
        method="dialog"
        onSubmit={(event) => {
          event.preventDefault();
          if (matches && !busy) onConfirm();
        }}
      >
        <h2 class="dialog__title" id={`${id}-title`}>
          {title}
        </h2>
        {description ? <p class="dialog__text">{description}</p> : null}
        {children}
        {confirmText === undefined ? null : (
          <div class="dialog__confirm">
            <label class="dialog__text" for={`${id}-confirm`}>
              {confirmPrompt}
            </label>
            <Input
              autoComplete="off"
              class="mono"
              id={`${id}-confirm`}
              onInput={(event) => setTyped(event.currentTarget.value)}
              spellcheck={false}
              value={typed}
            />
          </div>
        )}
        <div class="dialog__footer">
          <Button onClick={onClose} variant="ghost">
            {cancelLabel}
          </Button>
          <Button
            busy={busy}
            disabled={!matches}
            type="submit"
            variant={danger ? "danger" : "primary"}
          >
            {confirmLabel}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
