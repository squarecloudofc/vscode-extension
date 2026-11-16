import { useState } from "preact/hooks";

import {
  Button,
  Card,
  type Column,
  Dialog,
  EmptyState,
  Input,
  StatusDot,
  Table,
  type Tone,
} from "../../components";
import { Icon } from "../../components/icon";
import { NAV_ICON } from "../../icons";
import { locale, t } from "../../l10n";
import { formatDateTime } from "../../lib/format";
import { call } from "../../rpc";
import { Failure, useRpc, useTask } from "../shared/rpc";

/** `DeployEvent` in the SDK. */
type DeployEvent = {
  id: string;
  state: "pending" | "clone" | "commit" | "restarting" | "success" | "error";
  date: string;
  branch?: string;
  code?: string;
  message?: string;
  files?: { added: string[]; removed: string[]; modified: string[] };
};

type Deploys = {
  current: {
    app?: { id: number | null; name: string | null; branch: string | null };
    webhook?: string;
  };
  /** One timeline per deploy, oldest event first. */
  history: DeployEvent[][];
};

/** One deploy as a row: where its timeline ended. */
type Row = {
  key: string;
  sha: string;
  state: DeployEvent["state"];
  at: number;
  branch?: string;
  detail?: string;
};

const REPOSITORY = /^[\w.-]+\/[\w.-]+$/;

const STATE: Record<DeployEvent["state"], () => readonly [Tone, string]> = {
  pending: () => ["amber", t("app.deploys.state.pending")],
  clone: () => ["amber", t("app.deploys.state.clone")],
  commit: () => ["amber", t("app.deploys.state.commit")],
  restarting: () => ["amber", t("app.deploys.state.restarting")],
  success: () => ["green", t("app.deploys.state.success")],
  error: () => ["red", t("app.deploys.state.error")],
};

function rowsOf(history: DeployEvent[][]): Row[] {
  return history
    .flatMap((timeline, index) => {
      const last = timeline.at(-1);
      if (!last) return [];
      const files = timeline.find((e) => e.files)?.files;
      return [
        {
          key: `${last.id}:${index}`,
          sha: last.id,
          state: last.state,
          at: Date.parse(last.date),
          branch: timeline.find((e) => e.branch)?.branch,
          detail:
            last.state === "error"
              ? (last.message ?? last.code)
              : files
                ? `+${files.added.length} −${files.removed.length} ~${files.modified.length}`
                : undefined,
        },
      ];
    })
    .sort((a, b) => b.at - a.at);
}

export function DeploysTab() {
  const lang = locale();
  const load = useRpc<Deploys>("deploys");
  const link = useTask();
  const hook = useTask();
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [token, setToken] = useState("");
  const [confirm, setConfirm] = useState<"unlink" | "webhook">();
  const [copied, setCopied] = useState(false);

  if (load.error && !load.data)
    return <Failure error={load.error} onRetry={load.reload} />;

  const current = load.data?.current;
  const linked = current?.app?.name ? current.app : undefined;
  const repoInvalid = Boolean(repo) && !REPOSITORY.test(repo.trim());
  const rows = rowsOf(load.data?.history ?? []);

  const columns: Column<Row>[] = [
    {
      key: "state",
      label: t("app.deploys.status"),
      width: "140px",
      render: (row) => {
        const [tone, word] = STATE[row.state]();
        return <StatusDot label={word} pulse={false} tone={tone} />;
      },
    },
    {
      key: "sha",
      label: t("app.deploys.commit"),
      mono: true,
      width: "96px",
      render: (row) => <span title={row.sha}>{row.sha.slice(0, 7)}</span>,
    },
    { key: "branch", label: t("app.deploys.branch"), mono: true },
    {
      key: "detail",
      label: t("app.deploys.detail"),
      render: (row) => <span class="muted">{row.detail ?? ""}</span>,
    },
    {
      key: "at",
      label: t("app.deploys.when"),
      align: "end",
      mono: true,
      render: (row) => formatDateTime(row.at, lang),
    },
  ];

  return (
    <section class="stack">
      <div class="grid-2">
        <Card title={t("app.deploys.github")}>
          {!load.data ? (
            <p class="muted">{t("generic.loading")}</p>
          ) : linked ? (
            <div class="stack stack--tight">
              <p class="repo">
                <Icon name="github-logo" />
                <span class="mono repo__name">{linked.name}</span>
                <Icon class="muted" name="git-branch" />
                <span class="mono">{linked.branch}</span>
              </p>
              <p class="muted">{t("app.deploys.linkedBody")}</p>
              <div class="row">
                <Button
                  busy={link.busy}
                  icon="x"
                  onClick={() => setConfirm("unlink")}
                  size="xs"
                  variant="secondary"
                >
                  {t("app.deploys.unlink")}
                </Button>
              </div>
            </div>
          ) : (
            <form
              class="stack stack--tight"
              onSubmit={(event) => {
                event.preventDefault();
                if (!REPOSITORY.test(repo.trim()) || !branch.trim()) return;
                void link.run(async () => {
                  await call("deploys.link", {
                    repository: repo.trim(),
                    branch: branch.trim(),
                  });
                  load.reload();
                });
              }}
            >
              <p class="muted">{t("app.deploys.githubBody")}</p>
              <div class="form-row">
                <div class="field-label form-row__grow">
                  {t("app.deploys.repository")}
                  <Input
                    aria-label={t("app.deploys.repository")}
                    autoComplete="off"
                    class="mono"
                    invalid={repoInvalid}
                    onInput={(event) => setRepo(event.currentTarget.value)}
                    placeholder="octocat/hello-world"
                    spellcheck={false}
                    value={repo}
                  />
                </div>
                <div class="field-label">
                  {t("app.deploys.branch")}
                  <Input
                    aria-label={t("app.deploys.branch")}
                    autoComplete="off"
                    class="mono"
                    onInput={(event) => setBranch(event.currentTarget.value)}
                    spellcheck={false}
                    value={branch}
                  />
                </div>
              </div>
              {repoInvalid ? (
                <p class="field-error">{t("githubApp.invalidRepo")}</p>
              ) : null}
              <div class="row">
                <Button
                  busy={link.busy}
                  disabled={!repo.trim() || repoInvalid || !branch.trim()}
                  icon="github-logo"
                  size="xs"
                  type="submit"
                >
                  {t("app.deploys.link")}
                </Button>
              </div>
            </form>
          )}
          {link.error ? <Failure error={link.error} /> : null}
        </Card>

        <Card title={t("app.deploys.webhook")}>
          {!load.data ? (
            <p class="muted">{t("generic.loading")}</p>
          ) : current?.webhook ? (
            <div class="stack stack--tight">
              <p class="muted">{t("app.deploys.webhookSet")}</p>
              <p class="mono webhook-url">{current.webhook}</p>
              <div class="row">
                <Button
                  icon={copied ? "check" : "copy"}
                  onClick={() =>
                    void call("copy", { text: current.webhook }).then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    })
                  }
                  size="xs"
                  variant="secondary"
                >
                  {copied ? t("app.copied") : t("app.deploys.copyUrl")}
                </Button>
                <Button
                  busy={hook.busy}
                  icon="trash"
                  onClick={() => setConfirm("webhook")}
                  size="xs"
                  variant="ghost"
                >
                  {t("app.deploys.removeWebhook")}
                </Button>
              </div>
            </div>
          ) : (
            <form
              class="stack stack--tight"
              onSubmit={(event) => {
                event.preventDefault();
                if (!token.trim()) return;
                void hook.run(async () => {
                  await call("deploys.webhook", { token: token.trim() });
                  setToken("");
                  load.reload();
                });
              }}
            >
              <p class="muted">{t("app.deploys.webhookBody")}</p>
              <div class="field-label">
                {t("app.deploys.token")}
                <Input
                  aria-label={t("app.deploys.token")}
                  autoComplete="off"
                  class="mono"
                  onInput={(event) => setToken(event.currentTarget.value)}
                  placeholder="ghp_…"
                  spellcheck={false}
                  type="password"
                  value={token}
                />
              </div>
              <div class="row">
                <Button
                  busy={hook.busy}
                  disabled={!token.trim()}
                  icon="webhooks-logo"
                  size="xs"
                  type="submit"
                >
                  {t("app.deploys.setWebhook")}
                </Button>
              </div>
            </form>
          )}
          {hook.error ? <Failure error={hook.error} /> : null}
        </Card>
      </div>

      <Card flush title={t("app.deploys.history")}>
        {load.data && !rows.length ? (
          <div class="card__body">
            <EmptyState
              description={t("app.deploys.empty.body")}
              icon={NAV_ICON.deploys}
              title={t("app.deploys.empty.title")}
            />
          </div>
        ) : (
          <Table
            class="table-wrap--flush"
            columns={columns}
            empty={t("generic.loading")}
            label={t("app.deploys.history")}
            rowKey={(row) => row.key}
            rows={rows}
          />
        )}
      </Card>

      <Dialog
        busy={link.busy || hook.busy}
        cancelLabel={t("panel.cancel")}
        confirmLabel={
          confirm === "webhook"
            ? t("app.deploys.removeWebhook")
            : t("app.deploys.unlink")
        }
        danger
        description={
          confirm === "webhook"
            ? t("app.deploys.removeWebhookBody")
            : t("app.deploys.unlinkBody", { REPO: linked?.name ?? "" })
        }
        onClose={() => setConfirm(undefined)}
        onConfirm={() => {
          const which = confirm;
          setConfirm(undefined);
          const task = which === "webhook" ? hook : link;
          void task.run(async () => {
            if (which === "webhook")
              await call("deploys.webhook", { token: "@" });
            else await call("deploys.unlink");
            load.reload();
          });
        }}
        open={Boolean(confirm)}
        title={
          confirm === "webhook"
            ? t("app.deploys.removeWebhookTitle")
            : t("app.deploys.unlinkTitle")
        }
      />
    </section>
  );
}
