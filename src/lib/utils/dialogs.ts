import {
  type MessageItem,
  QuickPickItemKind,
  type QuickPickItem as VSCodeQuickPickItem,
  window,
} from "vscode";
import { t } from "vscode-ext-localisation";

type ConfirmItem = MessageItem & { id: "yes" | "no" };

interface ConfirmOptions {
  modal?: boolean;
  destructive?: boolean;
}

/**
 * Locale-safe yes/no confirmation. Uses a tagged `id` field so the result
 * doesn't depend on the translated label, which used to be the failure mode
 * in commands like commit/delete/purge.
 */
export async function confirm(
  message: string,
  options: ConfirmOptions = {},
): Promise<boolean> {
  const yes: ConfirmItem = { title: t("generic.yes"), id: "yes" };
  const no: ConfirmItem = {
    title: t("generic.no"),
    id: "no",
    isCloseAffordance: true,
  };

  const modal = options.modal ?? true;
  const choice = options.destructive
    ? await window.showWarningMessage<ConfirmItem>(message, { modal }, yes, no)
    : await window.showInformationMessage<ConfirmItem>(
        message,
        { modal },
        yes,
        no,
      );
  return choice?.id === "yes";
}

/**
 * Locale-safe information toast with action buttons. Returns the tagged `id`
 * of the clicked button (never the translated label), `undefined` when
 * dismissed. Replaces the hand-rolled `MessageItem & { id }` pattern that was
 * copy-pasted across commands.
 */
export async function showMessageWithActions<TId extends string>(
  message: string,
  actions: Array<{ id: TId; title: string }>,
): Promise<TId | undefined> {
  type ActionItem = MessageItem & { id: TId };
  const items: ActionItem[] = actions.map((action) => ({ ...action }));
  const choice = await window.showInformationMessage<ActionItem>(
    message,
    ...items,
  );
  return choice?.id;
}

interface QuickPickItem<TId extends string> {
  id: TId;
  label: string;
  description?: string;
  detail?: string;
}

/** A group heading. Rendered by VSCode as a divider and never selectable. */
interface QuickPickSeparator {
  separator: string;
}

export type PickEntry<TId extends string> =
  | QuickPickItem<TId>
  | QuickPickSeparator;

/**
 * Type-safe QuickPick that returns the picked item's `id` instead of its
 * (translated) label. `undefined` when the user dismisses. Entries carrying
 * `separator` become group headings.
 */
export async function pickOne<TId extends string>(
  entries: Array<PickEntry<TId>>,
  options: { title?: string; placeHolder?: string } = {},
): Promise<TId | undefined> {
  type Item = VSCodeQuickPickItem & { id?: TId };

  const items: Item[] = entries.map((entry) =>
    "separator" in entry
      ? { label: entry.separator, kind: QuickPickItemKind.Separator }
      : { ...entry },
  );

  const picked = await window.showQuickPick(items, {
    title: options.title,
    placeHolder: options.placeHolder ?? t("generic.choose"),
  });
  return picked?.id;
}
