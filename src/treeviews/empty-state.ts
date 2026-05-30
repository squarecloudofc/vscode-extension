import type { TreeItem } from "vscode";
import { t } from "vscode-ext-localisation";

import type { SquareCloudExtension } from "@/managers/extension";

import { GenericTreeItem } from "./items/generic";

/**
 * Standard empty-state rendering shared by all top-level tree views:
 *  - no API key  → empty array (welcome view kicks in)
 *  - still loading first refresh → "Loading..." item
 *  - finished loading but resource list is empty → caller-supplied items
 */
export async function emptyOrLoading<T extends TreeItem>(
  extension: SquareCloudExtension,
  emptyItems: () => T[] | Promise<T[]>,
): Promise<(T | GenericTreeItem)[]> {
  const apiKey = await extension.config.apiKey.get();
  if (!apiKey) return [];
  if (!extension.store.value.appsLoaded) {
    return [
      new GenericTreeItem(
        t("generic.loading"),
        "loading",
        undefined,
        "loading",
      ),
    ];
  }
  return emptyItems();
}
