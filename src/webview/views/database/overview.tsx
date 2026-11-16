import { useState } from "preact/hooks";

import type { DatabaseInfo, DatabaseStatus } from "../../protocol";
import {
  Alert,
  Button,
  Card,
  Dialog,
  IconButton,
  Stat,
  StatGrid,
  UsageBar,
} from "../../components";
import { locale, t } from "../../l10n";
import { engineName, PASSWORD_PLACEHOLDER } from "../../lib/database";
import {
  formatBytes,
  formatBytesParts,
  formatDateTime,
  formatPercent,
} from "../../lib/format";
import { call } from "../../rpc";
import { Copyable, Failure, useTask } from "../shared/rpc";

const MB = 1024 * 1024;
const MASK = "••••••••••••••••";

export function OverviewTab({
  info,
  status,
  busy,
}: {
  info: DatabaseInfo;
  status?: DatabaseStatus;
  /** An action or a restore is running: the readings stay, dimmed. */
  busy: boolean;
}) {
  const lang = locale();
  const on = status?.running === true;
  const stopped = status?.running === false ? t("app.stat.stopped") : undefined;
  const percent = on ? (status.ram / info.ram) * 100 : 0;
  const ram = formatBytesParts((on ? status.ram : 0) * MB, lang, 1);
  const storage = status?.storage
    ? formatBytesParts(status.storage, lang, 1)
    : undefined;
  const rate = (v = 0) => `${formatBytes(v, lang, 1)}/s`;

  return (
    <div class="stack">
      <h2 class="label">{t("app.usage")}</h2>
      <StatGrid>
        <Stat
          dimmed={busy}
          hint={stopped}
          label={t("panel.metrics.cpu")}
          value={on ? formatPercent(status.cpu, lang) : "—"}
        />
        <Stat
          dimmed={busy}
          hint={
            on
              ? t("app.stat.ofLimit", {
                  PERCENT: formatPercent(percent, lang, 0),
                })
              : stopped
          }
          label={t("panel.metrics.ram")}
          unit={
            on
              ? `${ram.unit} / ${formatBytes(info.ram * MB, lang, 1)}`
              : undefined
          }
          value={on ? ram.value : "—"}
        >
          {on ? <UsageBar percent={percent} /> : null}
        </Stat>
        <Stat
          dimmed={busy}
          hint={stopped}
          label={t("panel.metrics.network")}
          value={
            on ? (
              <span class="net-pair">
                <span>↓ {rate(status.network[0])}</span>
                <span>↑ {rate(status.network[1])}</span>
              </span>
            ) : (
              "—"
            )
          }
        />
        <Stat
          dimmed={busy}
          label={t("panel.metrics.storage")}
          unit={storage?.unit}
          value={storage?.value ?? "—"}
        />
      </StatGrid>

      <div class="overview-grid">
        <Card title={t("database.panel.connection")}>
          <div class="stack">
            <dl class="facts">
              <dt>{t("database.panel.engine")}</dt>
              <dd>{engineName(info.type)}</dd>
              <dt>{t("database.panel.host")}</dt>
              <dd>
                <Copyable
                  label={t("database.panel.host")}
                  line
                  text={info.host}
                />
              </dd>
              <dt>{t("database.panel.port")}</dt>
              <dd class="mono">{info.port}</dd>
              <dt>{t("database.panel.user")}</dt>
              <dd class="mono">{info.user}</dd>
              <dt>{t("database.panel.cluster")}</dt>
              <dd class="mono">{info.cluster}</dd>
              {on && status.uptime ? (
                <>
                  <dt>{t("app.info.started")}</dt>
                  <dd>{formatDateTime(status.uptime, lang)}</dd>
                </>
              ) : null}
              <dt>{t("app.info.created")}</dt>
              <dd>{formatDateTime(Date.parse(info.createdAt), lang)}</dd>
            </dl>
            <div class="field-label">
              {t("database.panel.url")}
              <div class="secret">
                <code class="secret__value" title={info.url}>
                  {info.url}
                </code>
                <CopyButton
                  label={t("database.panel.copyUrl")}
                  text={info.url}
                />
              </div>
              <span class="muted secret__hint">
                {t("database.panel.connectionHint", {
                  PLACEHOLDER: PASSWORD_PLACEHOLDER,
                })}
              </span>
            </div>
          </div>
        </Card>
        <Credentials info={info} />
      </div>
    </div>
  );
}

/** Copies `text` through the host and says so for two seconds. */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <IconButton
      icon={copied ? "check" : "copy"}
      label={copied ? t("app.copied") : label}
      onClick={() =>
        void call("copy", { text }).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
      }
    />
  );
}

/** The password and the certificate: reset either, save the certificate. */
function Credentials({ info }: { info: DatabaseInfo }) {
  const [confirm, setConfirm] = useState<"password" | "certificate">();
  // Redis applies a new password only after a stop and start, so it always
  // gets one.
  const forced = info.type === "redis";
  const [restart, setRestart] = useState(forced);
  const [fresh, setFresh] = useState(false);
  const [certReset, setCertReset] = useState(false);
  const [saved, setSaved] = useState<{ folder: string; files: string[] }>();
  const reset = useTask();
  const restarted = useTask();
  const cert = useTask();

  const runReset = () => {
    const kind = confirm;
    if (!kind) return;
    void reset.run(async () => {
      await call("reset", { kind });
      setConfirm(undefined);
      if (kind === "certificate") return setCertReset(true);
      setFresh(true);
      if (restart || forced)
        void restarted.run(() => call("action", { action: "stop-start" }));
    });
  };
  const download = () =>
    void cert.run(async () => {
      setSaved(
        (await call<{ folder: string; files: string[] } | null>(
          "certificate",
        )) ?? undefined,
      );
    });

  return (
    <Card title={t("database.panel.credentials")}>
      <div class="stack">
        <div class="setting-row">
          <div class="setting-row__text">
            <p class="setting-row__title">
              {t("database.panel.passwordTitle")}
            </p>
            <p class="muted">{t("database.panel.passwordBody")}</p>
          </div>
          <Button
            icon="key"
            onClick={() => {
              reset.clear();
              setRestart(forced);
              setConfirm("password");
            }}
            size="xs"
            variant="secondary"
          >
            {t("database.panel.passwordReset")}
          </Button>
        </div>
        {fresh ? (
          <FreshPassword
            onDone={() => {
              setFresh(false);
              void call("secret", { mode: "forget" });
            }}
            restart={restarted}
          />
        ) : null}

        <div class="setting-row">
          <div class="setting-row__text">
            <p class="setting-row__title">{t("database.panel.certTitle")}</p>
            <p class="muted">{t("database.panel.certBody")}</p>
          </div>
          <div class="row">
            <Button
              busy={cert.busy}
              icon="download-simple"
              onClick={download}
              size="xs"
              variant="secondary"
            >
              {t("database.certDownload")}
            </Button>
            <Button
              icon="certificate"
              onClick={() => {
                reset.clear();
                setConfirm("certificate");
              }}
              size="xs"
              variant="ghost"
            >
              {t("database.panel.certReset")}
            </Button>
          </div>
        </div>
        {certReset ? (
          <Alert intent="success" title={t("database.panel.certResetDone")} />
        ) : null}
        {saved ? (
          <Alert
            action={
              <Button
                onClick={() => void call("certificate.open")}
                size="xs"
                variant="secondary"
              >
                {t("database.openFolder")}
              </Button>
            }
            intent="success"
            title={t("database.panel.certSaved", {
              FILES: saved.files.join(", "),
            })}
          >
            <span class="mono">{saved.folder}</span>
          </Alert>
        ) : null}
        {cert.error ? <Failure error={cert.error} /> : null}
      </div>

      <Dialog
        busy={reset.busy}
        cancelLabel={t("panel.cancel")}
        confirmLabel={
          confirm === "certificate"
            ? t("database.panel.certReset")
            : t("database.panel.passwordReset")
        }
        danger
        description={
          confirm === "certificate"
            ? t("database.panel.certResetBody")
            : t("database.panel.passwordResetBody")
        }
        onClose={() => setConfirm(undefined)}
        onConfirm={runReset}
        open={Boolean(confirm)}
        title={
          confirm === "certificate"
            ? t("database.panel.certReset")
            : t("database.panel.passwordReset")
        }
      >
        <div class="stack stack--tight">
          {confirm === "password" ? (
            forced ? (
              <p class="dialog__text">{t("database.panel.stopStartForced")}</p>
            ) : (
              <label class="check">
                <input
                  checked={restart}
                  onChange={(event) => setRestart(event.currentTarget.checked)}
                  type="checkbox"
                />
                {t("database.panel.stopStart")}
              </label>
            )
          ) : null}
          {reset.error ? <Failure error={reset.error} /> : null}
        </div>
      </Dialog>
    </Card>
  );
}

/**
 * The password just reset, kept on the host: shown or copied only when
 * asked, and gone for good once the user says they saved it.
 */
function FreshPassword({
  onDone,
  restart,
}: {
  onDone(): void;
  restart: ReturnType<typeof useTask>;
}) {
  return (
    <div class="fresh">
      <div>
        <p class="setting-row__title">{t("database.panel.newPassword")}</p>
        <p class="muted">{t("database.panel.newPasswordBody")}</p>
      </div>
      <SecretField label={t("database.panel.newPassword")} what="password" />
      <SecretField label={t("database.panel.url")} what="url" />
      {restart.busy ? (
        <p class="muted" role="status">
          {t("database.panel.stopStarting")}
        </p>
      ) : restart.done ? (
        <p class="muted" role="status">
          {t("database.panel.stopStarted")}
        </p>
      ) : restart.error ? (
        <Alert intent="warning" title={t("database.panel.stopStartFailed")} />
      ) : null}
      <div class="row">
        <Button icon="check" onClick={onDone} size="xs">
          {t("database.panel.passwordAck")}
        </Button>
      </div>
    </div>
  );
}

function SecretField({
  label,
  what,
}: {
  label: string;
  what: "password" | "url";
}) {
  const [shown, setShown] = useState<string>();
  const [copied, setCopied] = useState(false);
  return (
    <div class="field-label">
      {label}
      <div class="secret">
        <code class="secret__value">{shown ?? MASK}</code>
        <IconButton
          icon={shown ? "eye-slash" : "eye"}
          label={shown ? t("database.panel.hide") : t("database.panel.reveal")}
          onClick={() =>
            shown
              ? setShown(undefined)
              : void call<string | null>("secret", {
                  mode: "reveal",
                  what,
                }).then((value) => setShown(value ?? undefined))
          }
        />
        <IconButton
          icon={copied ? "check" : "copy"}
          label={
            copied
              ? t("app.copied")
              : what === "url"
                ? t("database.panel.copyUrl")
                : t("database.panel.copyPassword")
          }
          onClick={() =>
            void call("secret", { mode: "copy", what }).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            })
          }
        />
      </div>
    </div>
  );
}
