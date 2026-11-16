import { env } from "vscode";
import { t } from "vscode-ext-localisation";

import {
  WORKSPACE_GROUPS,
  type WorkspaceGroup,
  type WorkspaceInfo,
} from "@/webview/protocol";

import type { Handlers, PanelContext } from "./panel-manager";

const field = (params: unknown, key: string): unknown =>
  typeof params === "object" && params !== null
    ? (params as Record<string, unknown>)[key]
    : undefined;

const text = (params: unknown, key: string): string => {
  const value = field(params, key);
  if (typeof value !== "string" || !value.trim())
    throw new Error(t("panel.error.body"));
  return value.trim();
};

const group = (params: unknown): WorkspaceGroup => {
  const value = field(params, "group");
  if (!WORKSPACE_GROUPS.includes(value as WorkspaceGroup))
    throw new Error(t("panel.error.body"));
  return value as WorkspaceGroup;
};

/**
 * The workspace panel's host side: members, apps, leave or delete. The API
 * decides who may do what (only the owner manages members); a refusal comes
 * back in words. Every change answers the workspace read again.
 */
export function workspacePanel({
  extension,
  id,
  panel,
  client,
}: PanelContext): Handlers {
  const known = () => extension.store.value.workspaces.find((w) => w.id === id);
  panel.title = known()?.name ?? id;

  const info = async (): Promise<WorkspaceInfo> => {
    const workspace = await (await client()).workspaces.get(id);
    const { user, applications } = extension.store.value;
    const inside = new Set(workspace.applications.map((app) => app.id));
    panel.title = workspace.name;
    return {
      id,
      name: workspace.name,
      createdAt: workspace.createdAt,
      owner: Boolean(user) && workspace.owner === user?.id,
      you: user?.id ?? null,
      members: workspace.members,
      apps: workspace.applications.map((app) => ({
        id: app.id,
        name: app.name,
        lang: app.lang,
        ram: app.ram,
        mine: applications.has(app.id),
      })),
      yours: Array.from(applications.values())
        .filter((app) => !inside.has(app.id))
        .map((app) => ({ id: app.id, name: app.name, lang: app.lang }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  };

  /** A change, then the sidebar's list and this workspace read again. */
  const change = async (work: () => Promise<unknown>) => {
    await work();
    void extension.api.refresh();
    return info();
  };
  const gone = () => {
    void extension.api.refresh();
    // After this answer is sent.
    setTimeout(() => panel.dispose(), 0);
  };

  return {
    info,

    "members.add": async (params) => {
      const api = await client();
      return change(() =>
        api.workspaces.members.add(id, text(params, "code"), group(params)),
      );
    },

    "members.update": async (params) => {
      const api = await client();
      return change(() =>
        api.workspaces.members.update(
          id,
          text(params, "member"),
          group(params),
        ),
      );
    },

    "members.remove": async (params) => {
      const api = await client();
      return change(() =>
        api.workspaces.members.remove(id, text(params, "member")),
      );
    },

    /** Your invite code (valid 5 minutes), copied as well. */
    invite: async () => {
      const code = await (await client()).workspaces.members.inviteCode();
      await env.clipboard.writeText(code);
      return code;
    },

    "apps.add": async (params) => {
      const api = await client();
      return change(() => api.workspaces.apps.add(id, text(params, "app")));
    },

    "apps.remove": async (params) => {
      const api = await client();
      return change(() => api.workspaces.apps.remove(id, text(params, "app")));
    },

    /** The app's panel; someone else's app is `<appId>-<workspaceId>` there. */
    "apps.open": async (params) => {
      const app = text(params, "app");
      extension.panels.openResource(
        "app",
        extension.store.value.applications.has(app) ? app : `${app}-${id}`,
      );
    },

    copy: async (params) => {
      const value = field(params, "text");
      if (typeof value === "string") await env.clipboard.writeText(value);
    },

    reconnect: () => extension.views.sidebar.signIn(),

    leave: async () => {
      await (await client()).workspaces.leave(id);
      gone();
    },

    delete: async () => {
      await (await client()).workspaces.delete(id);
      gone();
    },
  };
}

/** Every string the workspace panel's webview reads. */
export const WORKSPACE_STRINGS = [
  "app.copied",
  "app.files.name",
  "app.info.memory",
  "app.info.runtime",
  "app.network.domains.remove",
  "app.settings.deletePrompt",
  "app.settings.deleteTitle",
  "app.static",
  "command.copyId",
  "command.deleteWorkspace",
  "command.leaveWorkspace",
  "command.refresh",
  "command.setApiKey",
  "dashboard.more",
  "generic.loading",
  "panel.actions",
  "panel.cancel",
  "panel.error.body",
  "panel.reconnect.action",
  "panel.reconnect.body",
  "panel.reconnect.title",
  "panel.retry",
  "sidebar.signIn.title",
  "panel.tab.settings",
  "panel.tabs",
  "problem.rateLimit.title",
  "sidebar.workspace.invite",
  "workspace.panel.add",
  "workspace.panel.addApp",
  "workspace.panel.addAppBody",
  "workspace.panel.added",
  "workspace.panel.apps",
  "workspace.panel.appsEmpty",
  "workspace.panel.appsEmptyBody",
  "workspace.panel.code",
  "workspace.panel.codePlaceholder",
  "workspace.panel.copied",
  "workspace.panel.deleteBody",
  "workspace.panel.deleteConfirm",
  "workspace.panel.group.admin",
  "workspace.panel.group.maintain",
  "workspace.panel.group.manager",
  "workspace.panel.group.view",
  "workspace.panel.inviteBody",
  "workspace.panel.joined",
  "workspace.panel.leaveBody",
  "workspace.panel.leaveConfirm",
  "workspace.panel.leaveTitle",
  "workspace.panel.loadError",
  "workspace.panel.memberAdd",
  "workspace.panel.memberAddBody",
  "workspace.panel.members",
  "workspace.panel.membersBody",
  "workspace.panel.noYours",
  "workspace.panel.ownerOnly",
  "workspace.panel.removeApp",
  "workspace.panel.removeMember",
  "workspace.panel.removeMemberBody",
  "workspace.panel.removedUser",
  "workspace.panel.role",
  "workspace.panel.roles.admin",
  "workspace.panel.roles.maintain",
  "workspace.panel.roles.manager",
  "workspace.panel.roles.owner",
  "workspace.panel.roles.view",
  "workspace.panel.you",
];
