import { useEffect, useState } from "preact/hooks";

import {
  Alert,
  Button,
  Card,
  type Column,
  Dialog,
  EmptyState,
  IconButton,
  Input,
  Menu,
  Select,
  Skeleton,
  Table,
  Tabs,
} from "../components";
import { Icon, Logo } from "../components/icon";
import { NAV_ICON, type NavIconName } from "../icons";
import { locale, t } from "../l10n";
import { formatBytes, formatDateTime } from "../lib/format";
import {
  type PanelInit,
  WORKSPACE_GROUPS,
  WORKSPACE_TABS,
  type WorkspaceGroup,
  type WorkspaceInfo,
  type WorkspaceTab,
} from "../protocol";
import { call, onHostMessage, persist, RpcError } from "../rpc";
import { runtimeName } from "./app/runtime";
import { Failure, useRpc, useTask } from "./shared/rpc";

// The workspace panel: who is in it and with which role, the apps it
// shares, and leaving or deleting it. The API decides who may change what
// (only the owner manages members); the screen offers only what applies.
// The host side is src/panels/workspace.ts.

type Member = WorkspaceInfo["members"][number];
type App = WorkspaceInfo["apps"][number];

const validTab = (tab: unknown): WorkspaceTab =>
  WORKSPACE_TABS.includes(tab as WorkspaceTab)
    ? (tab as WorkspaceTab)
    : "members";

const TABS: Record<WorkspaceTab, { icon: NavIconName; label: () => string }> = {
  members: {
    icon: NAV_ICON.workspaces,
    label: () => t("workspace.panel.members"),
  },
  applications: {
    icon: NAV_ICON.applications,
    label: () => t("workspace.panel.apps"),
  },
  settings: { icon: NAV_ICON.settings, label: () => t("panel.tab.settings") },
};

const ROLES: Record<WorkspaceGroup | "owner", () => string> = {
  owner: () => t("workspace.panel.roles.owner"),
  admin: () => t("workspace.panel.roles.admin"),
  maintain: () => t("workspace.panel.roles.maintain"),
  manager: () => t("workspace.panel.roles.manager"),
  view: () => t("workspace.panel.roles.view"),
};
const role = (group: WorkspaceGroup | "owner") => ROLES[group]();

/** What each role can do, as the site words it. */
const REACH: Record<WorkspaceGroup, () => string> = {
  admin: () => t("workspace.panel.group.admin"),
  maintain: () => t("workspace.panel.group.maintain"),
  manager: () => t("workspace.panel.group.manager"),
  view: () => t("workspace.panel.group.view"),
};

/** A refusal for want of the owner's rights, said as such. */
const refusal = (error: unknown) =>
  error instanceof RpcError && error.code === "RESOURCE_NOT_ALLOWED"
    ? new Error(t("workspace.panel.ownerOnly"))
    : error;

export function WorkspacePanel({ state }: { state: PanelInit | undefined }) {
  const [tab, setTabState] = useState<WorkspaceTab>(validTab(state?.tab));
  const info = useRpc<WorkspaceInfo>("info");
  const invite = useTask();
  const [code, setCode] = useState<string>();
  const [copied, setCopied] = useState(false);

  const setTab = (next: WorkspaceTab) => {
    setTabState(next);
    persist({ tab: next });
  };

  useEffect(
    () =>
      onHostMessage((message) => {
        const next = (message as { state?: { tab?: unknown } }).state?.tab;
        if (message.type === "state" && typeof next === "string")
          setTabState(validTab(next));
      }),
    [],
  );

  if (info.error && !info.data)
    return (
      <main class="page">
        <Failure
          error={info.error}
          onRetry={info.reload}
          title={t("workspace.panel.loadError")}
        />
      </main>
    );
  if (!info.data)
    return (
      <main aria-busy="true" class="page">
        <Skeleton height={40} width={320} />
        <Skeleton col={1} height={40} />
        <Skeleton col={2} height={200} />
      </main>
    );

  const workspace = info.data;
  const lang = locale();
  const copyId = () =>
    void call("copy", { text: workspace.id }).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });

  return (
    <main class="page">
      <header class="page__head">
        <div class="page__identity">
          <span class="page__logo">
            <Icon name={NAV_ICON.workspaces} size={20} />
          </span>
          <div class="page__names">
            <h1 class="page__title">{workspace.name}</h1>
            <p class="page__meta">
              <button
                class="page__id mono"
                onClick={copyId}
                title={t("command.copyId")}
                type="button"
              >
                {copied ? t("app.copied") : workspace.id}
              </button>
              <span>
                {formatDateTime(Date.parse(workspace.createdAt), lang, true)}
              </span>
              <span>
                {role(workspace.owner ? "owner" : ownGroup(workspace))}
              </span>
            </p>
          </div>
        </div>
        <div class="page__actions">
          <Button
            busy={invite.busy}
            icon={invite.done ? "check" : "copy"}
            onClick={() =>
              void invite.run(async () => setCode(await call<string>("invite")))
            }
            size="xs"
            variant="secondary"
          >
            {t("sidebar.workspace.invite")}
          </Button>
          <Menu
            items={[
              { label: t("command.copyId"), icon: "copy", onSelect: copyId },
              {
                label: t("command.refresh"),
                icon: "arrow-clockwise",
                onSelect: info.reload,
              },
              "separator",
              workspace.owner
                ? {
                    label: t("command.deleteWorkspace"),
                    icon: "trash",
                    danger: true,
                    onSelect: () => setTab("settings"),
                  }
                : {
                    label: t("command.leaveWorkspace"),
                    icon: "sign-out",
                    danger: true,
                    onSelect: () => setTab("settings"),
                  },
            ]}
            label={t("dashboard.more")}
          />
        </div>
      </header>

      {code ? (
        <Alert
          intent="success"
          title={t("workspace.panel.copied", { CODE: code })}
        >
          {t("workspace.panel.inviteBody")}
        </Alert>
      ) : null}
      {invite.error ? <Failure error={invite.error} /> : null}

      <Tabs
        items={WORKSPACE_TABS.map((id) => ({
          id,
          icon: TABS[id].icon,
          label: TABS[id].label(),
        }))}
        label={t("panel.tabs")}
        onChange={(id) => setTab(validTab(id))}
        value={tab}
      />

      {tab === "members" ? (
        <MembersTab info={workspace} lang={lang} onChange={info.set} />
      ) : tab === "applications" ? (
        <AppsTab info={workspace} lang={lang} onChange={info.set} />
      ) : (
        <SettingsTab info={workspace} />
      )}
    </main>
  );
}

/** The signed-in user's role here (`view` if their row isn't found). */
const ownGroup = (info: WorkspaceInfo): WorkspaceGroup | "owner" =>
  info.members.find((m) => m.id === info.you)?.group ?? "view";

const GROUP_OPTIONS = () =>
  WORKSPACE_GROUPS.map((group) => ({ value: group, label: role(group) }));

function MembersTab({
  info,
  lang,
  onChange,
}: {
  info: WorkspaceInfo;
  lang: string;
  onChange(next: WorkspaceInfo): void;
}) {
  const change = useTask();
  const add = useTask();
  const [busy, setBusy] = useState<string>();
  const [removing, setRemoving] = useState<Member>();
  const [code, setCode] = useState("");
  const [group, setGroup] = useState<WorkspaceGroup>("view");
  const [added, setAdded] = useState<string>();
  const name = (m: Member) => m.name ?? t("workspace.panel.removedUser");

  const run = (member: string, method: string, params: object) => {
    setBusy(member);
    return change
      .run(async () => {
        try {
          onChange(await call<WorkspaceInfo>(method, params));
        } catch (error) {
          throw refusal(error);
        }
      })
      .finally(() => setBusy(undefined));
  };

  const columns: Column<Member>[] = [
    {
      key: "name",
      label: t("app.files.name"),
      render: (m) => (
        <span class={m.name ? undefined : "muted"}>
          {name(m)}
          {m.id === info.you ? (
            <span class="muted"> {t("workspace.panel.you")}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: "group",
      label: t("workspace.panel.role"),
      width: "200px",
      render: (m) =>
        info.owner && m.group !== "owner" && m.id !== info.you ? (
          <Select
            aria-label={t("workspace.panel.role")}
            disabled={busy === m.id}
            onChange={(event) => {
              const next = event.currentTarget.value as WorkspaceGroup;
              if (next !== m.group)
                void run(m.id, "members.update", { member: m.id, group: next });
            }}
            options={GROUP_OPTIONS()}
            value={m.group}
          />
        ) : (
          role(m.group)
        ),
    },
    {
      key: "joined",
      label: t("workspace.panel.joined"),
      mono: true,
      render: (m) => formatDateTime(Date.parse(m.joinedAt), lang, true),
    },
    {
      key: "actions",
      label: <span class="visually-hidden">{t("panel.actions")}</span>,
      align: "end",
      width: "56px",
      render: (m) =>
        info.owner && m.group !== "owner" && m.id !== info.you ? (
          <IconButton
            busy={busy === m.id}
            icon="trash"
            label={t("workspace.panel.removeMember", { NAME: name(m) })}
            onClick={() => setRemoving(m)}
          />
        ) : null,
    },
  ];

  return (
    <section class="stack">
      <p class="muted section-lede">{t("workspace.panel.membersBody")}</p>
      {change.error ? <Failure error={change.error} /> : null}
      <Table
        columns={columns}
        label={t("workspace.panel.members")}
        rowKey={(m) => m.id}
        rows={info.members}
      />

      {info.owner ? (
        <Card title={t("workspace.panel.memberAdd")}>
          <form
            class="stack stack--tight"
            onSubmit={(event) => {
              event.preventDefault();
              if (!code.trim()) return;
              setAdded(undefined);
              void add.run(async () => {
                try {
                  onChange(
                    await call<WorkspaceInfo>("members.add", {
                      code: code.trim(),
                      group,
                    }),
                  );
                } catch (error) {
                  throw refusal(error);
                }
                setAdded(role(group));
                setCode("");
              });
            }}
          >
            <p class="muted">{t("workspace.panel.memberAddBody")}</p>
            <div class="form-row">
              <div class="field-label form-row__grow">
                {t("workspace.panel.code")}
                <Input
                  aria-label={t("workspace.panel.code")}
                  autoComplete="off"
                  class="mono"
                  onInput={(event) => setCode(event.currentTarget.value)}
                  placeholder={t("workspace.panel.codePlaceholder")}
                  spellcheck={false}
                  value={code}
                />
              </div>
              <div class="field-label">
                {t("workspace.panel.role")}
                <Select
                  aria-label={t("workspace.panel.role")}
                  onChange={(event) =>
                    setGroup(event.currentTarget.value as WorkspaceGroup)
                  }
                  options={GROUP_OPTIONS()}
                  value={group}
                />
              </div>
            </div>
            <p class="muted role-hint">
              <Icon name="info" size={14} />
              {REACH[group]()}
            </p>
            <div class="row">
              <Button
                busy={add.busy}
                disabled={!code.trim()}
                icon="user-plus"
                size="xs"
                type="submit"
              >
                {t("workspace.panel.add")}
              </Button>
              {added ? (
                <span class="muted" role="status">
                  {t("workspace.panel.added", { ROLE: added })}
                </span>
              ) : null}
            </div>
            {add.error ? <Failure error={add.error} /> : null}
          </form>
        </Card>
      ) : (
        <p class="role-hint muted">
          <Icon name="info" size={14} />
          {t("workspace.panel.ownerOnly")}
        </p>
      )}

      <Dialog
        busy={change.busy}
        cancelLabel={t("panel.cancel")}
        confirmLabel={t("app.network.domains.remove")}
        danger
        description={
          removing
            ? t("workspace.panel.removeMemberBody", { NAME: name(removing) })
            : undefined
        }
        onClose={() => setRemoving(undefined)}
        onConfirm={() => {
          const member = removing;
          setRemoving(undefined);
          if (member)
            void run(member.id, "members.remove", { member: member.id });
        }}
        open={Boolean(removing)}
        title={t("workspace.panel.removeMember", {
          NAME: removing ? name(removing) : "",
        })}
      />
    </section>
  );
}

function AppsTab({
  info,
  lang,
  onChange,
}: {
  info: WorkspaceInfo;
  lang: string;
  onChange(next: WorkspaceInfo): void;
}) {
  const change = useTask();
  const [busy, setBusy] = useState<string>();
  const [picked, setPicked] = useState(info.yours[0]?.id ?? "");
  const choice = info.yours.some((a) => a.id === picked)
    ? picked
    : (info.yours[0]?.id ?? "");

  const run = (app: string, method: string) => {
    setBusy(app);
    void change
      .run(async () => {
        try {
          onChange(await call<WorkspaceInfo>(method, { app }));
        } catch (error) {
          throw refusal(error);
        }
      })
      .finally(() => setBusy(undefined));
  };

  const columns: Column<App>[] = [
    {
      key: "name",
      label: t("app.files.name"),
      render: (app) => (
        <span class="row">
          <Logo kind="app" value={app.lang} />
          {app.name}
        </span>
      ),
    },
    {
      key: "lang",
      label: t("app.info.runtime"),
      render: (app) => runtimeName(app.lang),
    },
    {
      key: "ram",
      label: t("app.info.memory"),
      align: "end",
      mono: true,
      render: (app) => formatBytes(app.ram * 1024 ** 2, lang, 1),
    },
    {
      key: "actions",
      label: <span class="visually-hidden">{t("panel.actions")}</span>,
      align: "end",
      width: "56px",
      render: (app) =>
        info.owner || app.mine ? (
          <IconButton
            busy={busy === app.id}
            icon="x"
            label={t("workspace.panel.removeApp", { NAME: app.name })}
            onClick={(event) => {
              // The row opens the app; this button only takes it out.
              event.stopPropagation();
              run(app.id, "apps.remove");
            }}
          />
        ) : null,
    },
  ];

  return (
    <section class="stack">
      {change.error ? <Failure error={change.error} /> : null}
      {info.apps.length ? (
        <Table
          columns={columns}
          label={t("workspace.panel.apps")}
          onRowClick={(app) => void call("apps.open", { app: app.id })}
          rowKey={(app) => app.id}
          rows={info.apps}
        />
      ) : (
        <EmptyState
          description={t("workspace.panel.appsEmptyBody")}
          icon={NAV_ICON.applications}
          title={t("workspace.panel.appsEmpty")}
        />
      )}

      <Card title={t("workspace.panel.addApp")}>
        <div class="stack stack--tight">
          <p class="muted">{t("workspace.panel.addAppBody")}</p>
          {info.yours.length ? (
            <div class="form-row">
              <Select
                aria-label={t("workspace.panel.addApp")}
                class="form-row__grow"
                onChange={(event) => setPicked(event.currentTarget.value)}
                options={info.yours.map((app) => ({
                  value: app.id,
                  label: app.name,
                }))}
                value={choice}
              />
              <Button
                busy={busy === choice}
                disabled={!choice}
                icon="plus"
                onClick={() => run(choice, "apps.add")}
                variant="secondary"
              >
                {t("workspace.panel.add")}
              </Button>
            </div>
          ) : (
            <p class="muted">{t("workspace.panel.noYours")}</p>
          )}
        </div>
      </Card>
    </section>
  );
}

function SettingsTab({ info }: { info: WorkspaceInfo }) {
  const task = useTask();
  const [confirming, setConfirming] = useState(false);
  const owner = info.owner;
  return (
    <section class="stack settings">
      <Card
        class="card--danger"
        title={
          owner ? t("command.deleteWorkspace") : t("command.leaveWorkspace")
        }
      >
        <div class="stack stack--tight">
          <p class="muted">
            {owner
              ? t("workspace.panel.deleteBody")
              : t("workspace.panel.leaveBody")}
          </p>
          {task.error ? <Failure error={task.error} /> : null}
          <div class="row">
            <Button
              busy={task.busy}
              icon={owner ? "trash" : "sign-out"}
              onClick={() => setConfirming(true)}
              size="xs"
              variant="danger"
            >
              {owner
                ? t("command.deleteWorkspace")
                : t("command.leaveWorkspace")}
            </Button>
          </div>
        </div>
      </Card>
      <Dialog
        busy={task.busy}
        cancelLabel={t("panel.cancel")}
        confirmLabel={
          owner ? t("command.deleteWorkspace") : t("command.leaveWorkspace")
        }
        confirmPrompt={
          owner
            ? t("app.settings.deletePrompt", { NAME: info.name })
            : undefined
        }
        confirmText={owner ? info.name : undefined}
        danger
        description={
          owner
            ? t("workspace.panel.deleteConfirm", { NAME: info.name })
            : t("workspace.panel.leaveConfirm", { NAME: info.name })
        }
        onClose={() => setConfirming(false)}
        onConfirm={() =>
          void task.run(async () => {
            await call(owner ? "delete" : "leave");
            setConfirming(false);
          })
        }
        open={confirming}
        title={
          owner
            ? t("app.settings.deleteTitle", { NAME: info.name })
            : t("workspace.panel.leaveTitle", { NAME: info.name })
        }
      />
    </section>
  );
}
