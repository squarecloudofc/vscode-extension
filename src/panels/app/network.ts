import type { SquareCloudAPI } from "@squarecloud/api";
import { t } from "vscode-ext-localisation";

import { cleanFilters, normalizeDomain } from "@/webview/lib/network";

import type { Handlers } from "../panel-manager";

const field = (params: unknown, key: string): unknown =>
  typeof params === "object" && params !== null
    ? (params as Record<string, unknown>)[key]
    : undefined;

/** The window the webview asked for: two ISO timestamps. */
function windowOf(params: unknown): [string, string] {
  const [start, end] = [field(params, "start"), field(params, "end")];
  if (
    typeof start !== "string" ||
    typeof end !== "string" ||
    Number.isNaN(Date.parse(start)) ||
    Number.isNaN(Date.parse(end))
  )
    throw new Error(t("app.network.range.invalid"));
  return [start, end];
}

/**
 * The Network tab's RPC methods (`network.*` in AppMethod). Analytics,
 * errors and performance answer null for a window without traffic.
 */
export function networkHandlers(
  id: string,
  client: () => Promise<SquareCloudAPI>,
): Handlers {
  const network = async () => (await client()).apps.network;
  return {
    "network.analytics": async (params) =>
      (await network()).analytics(
        id,
        ...windowOf(params),
        cleanFilters(field(params, "filters")),
      ),

    "network.errors": async (params) =>
      (await network()).errors(id, ...windowOf(params), {
        include_4xx: field(params, "include4xx") === true,
      }),

    "network.logs": async (params) =>
      (await network()).logs(id, ...windowOf(params)),

    "network.performance": async (params) =>
      (await network()).performance(id, ...windowOf(params)),

    "network.dns": async () => (await network()).dns(id),

    /** Sets a custom domain (checked as the site does), or `@` removes it. */
    "network.domain": async (params) => {
      const typed = field(params, "domain");
      if (typed === "@") return (await network()).setDomain(id, "@");
      const checked =
        typeof typed === "string" ? normalizeDomain(typed) : undefined;
      if (!checked || "error" in checked)
        throw new Error(t("app.network.domains.invalid"));
      await (await network()).setDomain(id, checked.domain);
    },

    "network.purge": async () => (await network()).purgeCache(id),
  };
}
