import { type MessageItem, window } from "vscode";
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

interface QuickPickItem<TId extends string> {
  id: TId;
  label: string;
  description?: string;
  detail?: string;
}

/**
 * Type-safe QuickPick that returns the picked item's `id` instead of its
 * (translated) label. `undefined` when the user dismisses.
 */
export async function pickOne<TId extends string>(
  items: Array<QuickPickItem<TId>>,
  options: { title?: string; placeHolder?: string } = {},
): Promise<TId | undefined> {
  const picked = await window.showQuickPick(items, {
    title: options.title,
    placeHolder: options.placeHolder ?? t("generic.choose"),
  });
  return picked?.id;
}
