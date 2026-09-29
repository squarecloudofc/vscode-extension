import { commands } from "vscode";

import type { SquareCloudExtension } from "@/managers/extension";
import { Command } from "@/structures/command";

/** `walkthroughs[].id` in package.json. */
const WALKTHROUGH_ID = "getStarted";
const OFFERED_KEY = "walkthroughOffered";

export const getStarted = new Command("getStarted", (extension) =>
  commands.executeCommand(
    "workbench.action.openWalkthrough",
    `${extension.context.extension.id}#${WALKTHROUGH_ID}`,
    false,
  ),
);

/**
 * Opens the walkthrough on the very first activation, only for someone who is
 * not connected yet. The flag is set either way, so it never shows up again —
 * not after a logout, not for someone who upgraded already connected.
 */
export async function offerWalkthroughOnce(
  extension: SquareCloudExtension,
): Promise<void> {
  const { globalState } = extension.context;
  if (globalState.get(OFFERED_KEY)) return;
  await globalState.update(OFFERED_KEY, true);
  if (await extension.config.apiKey.get()) return;
  await getStarted.execute(extension);
}
