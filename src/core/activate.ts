import type { ExtensionContext } from "vscode";

import { SquareCloudExtension } from "@/managers/extension";

export async function activate(context: ExtensionContext): Promise<void> {
  new SquareCloudExtension(context);
}
