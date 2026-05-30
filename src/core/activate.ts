import type { ExtensionContext } from "vscode";

import { SquareCloudExtension } from "@/managers/extension";

export function activate(context: ExtensionContext): void {
  context.subscriptions.push(new SquareCloudExtension(context));
}
