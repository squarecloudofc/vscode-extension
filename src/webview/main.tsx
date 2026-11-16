import "./styles/tokens.css";
import "./styles/base.css";

import { type ComponentType, render } from "preact";
import { useEffect, useState } from "preact/hooks";

import type { Boot, ViewName } from "./protocol";
import { setStrings } from "./l10n";
import { setLogoBase } from "./lib/logos";
import { RESOURCE_KINDS } from "./protocol";
import { onHostMessage, persist, persisted, post } from "./rpc";
import { AppPanel } from "./views/app";
import { BlobPanel } from "./views/blob";
import { DatabasePanel } from "./views/database";
import { Gallery } from "./views/gallery";
import { Sidebar } from "./views/sidebar";
import { WorkspacePanel } from "./views/workspace";

type ViewProps = { view: ViewName; state: any };

// Every screen of the bundle. The gallery is scripts/preview's alone: a
// production build drops it (and the code only it uses).
const VIEWS: Partial<Record<ViewName, ComponentType<ViewProps>>> = {
  sidebar: Sidebar,
  app: AppPanel,
  database: DatabasePanel,
  workspace: WorkspacePanel,
  blob: BlobPanel,
  ...(__PREVIEW__ ? { gallery: Gallery } : {}),
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A panel's host state is merged shallowly (it can be sent `{tab}` alone);
 * the sidebar's comes whole and replaces it, since JSON drops the fields
 * that went undefined.
 */
const merge = (previous: unknown, next: unknown) =>
  isObject(previous) && isObject(next) ? { ...previous, ...next } : next;

const boot = JSON.parse(
  document.getElementById("sq-boot")?.textContent ?? "{}",
) as Boot;
setStrings(boot.l10n ?? {});
setLogoBase(boot.brand ?? "");

// A panel remembers its resource and tab across reloads: that is also what
// the panel serializer gets back to reopen it after VS Code restarts.
const isPanel = (RESOURCE_KINDS as readonly string[]).includes(boot.view);
const initial = isPanel ? merge(boot.initial, persisted()) : boot.initial;
if (isPanel && isObject(initial)) persist(initial);

function App() {
  const [state, setState] = useState<unknown>(initial);

  useEffect(() => {
    const off = onHostMessage((message) => {
      if (message.type !== "state" || message.view !== boot.view) return;
      setState((previous: unknown) =>
        isPanel ? merge(previous, message.state) : message.state,
      );
      if (isPanel && isObject(message.state) && "tab" in message.state)
        persist({ tab: message.state.tab });
    });
    post({ type: "ready" });
    return off;
  }, []);

  const View = VIEWS[boot.view];
  return View ? <View state={state} view={boot.view} /> : null;
}

const root = document.getElementById("root");
if (root) render(<App />, root);
