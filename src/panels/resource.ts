import type { Snapshot, SquareCloudAPI } from "@squarecloud/api";
import { join } from "node:path";
import { window } from "vscode";
import { t } from "vscode-ext-localisation";

import { saveSnapshot } from "@/commands/applications/tools/snapshot";
import { describeCode } from "@/lib/utils/errors";

import type { Handlers } from "./panel-manager";

/**
 * What the app and database panels share: the `metrics` and `snapshots*`
 * RPC methods that src/webview/views/shared/{metrics,snapshots}.tsx call.
 * `pick` gives the resource's half of the SDK (`api.apps` or
 * `api.databases`), which have the same shape.
 */
type Resource = Pick<SquareCloudAPI["apps"], "metrics" | "snapshots">;

/** A snapshot as the panel lists it: no signed URL leaves the host. */
export type SnapshotRow = Pick<
  Snapshot,
  "name" | "size" | "modified" | "version_id" | "runtime" | "origin"
>;

const text = (params: unknown, key: string): string | undefined => {
  const value =
    typeof params === "object" && params !== null
      ? (params as Record<string, unknown>)[key]
      : undefined;
  return typeof value === "string" && value ? value : undefined;
};

export function resourceHandlers(
  id: string,
  client: () => Promise<SquareCloudAPI>,
  pick: (api: SquareCloudAPI) => Resource,
): Handlers {
  const resource = async () => pick(await client());

  /** The listed snapshot, read again so its signed URL is fresh. */
  const find = async (params: unknown) => {
    const name = text(params, "name");
    const version = text(params, "version");
    const list = await (await resource()).snapshots.list(id);
    return list.find((s) => s.name === name && s.version_id === version);
  };

  return {
    // Newest first, as the API sends them.
    metrics: async (params) =>
      (await resource()).metrics(id, {
        range: text(params, "range") === "7d" ? "7d" : "24h",
      }),

    snapshots: async (): Promise<SnapshotRow[]> =>
      (await (await resource()).snapshots.list(id))
        .map(({ name, size, modified, version_id, runtime, origin }) => ({
          name,
          size,
          modified,
          version_id,
          runtime,
          origin,
        }))
        .sort((a, b) => Date.parse(b.modified) - Date.parse(a.modified)),

    // `{pending: true}`: still generating, in the list in about 2 minutes.
    "snapshots.create": async () => ({
      pending: (await (await resource()).snapshots.create(id)).pending,
    }),

    /** Into a folder the user picks; the saved file's path, or null. */
    "snapshots.download": async (params) => {
      const snapshot = await find(params);
      if (!snapshot) return null;
      const [folder] =
        (await window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          openLabel: t("snapshot.save"),
          title: t("command.snapshot"),
        })) ?? [];
      if (!folder) return null;
      const date = new Date(snapshot.modified)
        .toISOString()
        .slice(0, 16)
        .replace(/[:T]/g, "-");
      const file = join(
        folder.fsPath,
        `${snapshot.name.replace(/[^\w.-]/g, "_")}-${date}.zip`,
      );
      await saveSnapshot(await client(), snapshot.url, file);
      return file;
    },

    // `{pending: true}`: it outlived the request and keeps running.
    "snapshots.restore": async (params) => {
      const name = text(params, "name");
      const version = text(params, "version");
      if (!name || !version) throw new Error("No snapshot given");
      return (await resource()).snapshots.restore(id, name, version);
    },

    /** The node's record of the last restore, with its error in words. */
    "snapshots.restoreState": async () => {
      const state = await (await resource()).snapshots.restoreState(id);
      return state.code
        ? { ...state, message: describeCode(state.code) }
        : state;
    },
  };
}
