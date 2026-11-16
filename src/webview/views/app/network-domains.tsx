import { useEffect, useState } from "preact/hooks";

import type { AppInfo } from "../../protocol";
import {
  Alert,
  Badge,
  Button,
  Card,
  type Column,
  Dialog,
  IconButton,
  Input,
  StatusDot,
  Table,
  type Tone,
} from "../../components";
import { Icon } from "../../components/icon";
import { t } from "../../l10n";
import { dnsPending, dnsRole, normalizeDomain } from "../../lib/network";
import { call } from "../../rpc";
import { Copyable, Failure, useRpc, useTask } from "../shared/rpc";

// Domains: the default address, the custom domain, the DNS records it needs
// (with what each one is for, why it isn't active yet, and the alternative
// SSL record) and the edge cache. The site's Settings → Network.

/** `DNSRecord` in the SDK. */
type Record_ = {
  type: "txt" | "cname";
  name: string;
  value: string;
  status: string;
  errors?: string[];
  fallback?: boolean;
};

/** Pending records are checked again this often, as the site does. */
const DNS_POLL_MS = 60_000;

const ROLE = {
  traffic: () => t("app.network.dns.role.traffic"),
  ownership: () => t("app.network.dns.role.ownership"),
  certificate: () => t("app.network.dns.role.certificate"),
} as const;

function recordStatus(status: string): readonly [Tone, string] {
  if (status === "active") return ["green", t("app.network.dns.active")];
  if (/issu|deploy/.test(status)) return ["blue", t("app.network.dns.issuing")];
  return ["amber", t("app.network.dns.pending")];
}

export function DomainsSection({
  info,
  onChanged,
}: {
  info: AppInfo;
  onChanged(): void;
}) {
  const [typed, setTyped] = useState("");
  const [removing, setRemoving] = useState(false);
  const [saved, setSaved] = useState<string>();
  const save = useTask();
  const remove = useTask();
  const purge = useTask();

  const checked = typed.trim() ? normalizeDomain(typed) : undefined;
  const error =
    checked && "error" in checked
      ? checked.error === "reserved"
        ? t("app.network.domains.reserved")
        : t("app.network.domains.invalid")
      : undefined;
  const domain = checked && "domain" in checked ? checked.domain : undefined;

  const submit = () => {
    if (!domain) return;
    void save.run(async () => {
      await call("network.domain", { domain });
      setSaved(domain);
      setTyped("");
      onChanged();
    });
  };

  return (
    <div class="stack">
      <div class="grid-2">
        <Card title={t("app.network.domains.default")}>
          <div class="stack stack--tight">
            <p class="muted">{t("app.network.domains.defaultBody")}</p>
            {info.subdomain ? (
              <div class="row row--between">
                <Copyable label={t("app.network.copy")} text={info.subdomain} />
                <Button
                  icon="arrow-square-out"
                  onClick={() =>
                    void call("open", { target: "site", host: info.subdomain })
                  }
                  size="xs"
                  variant="ghost"
                >
                  {t("app.open")}
                </Button>
              </div>
            ) : (
              <p class="muted">{t("app.network.domains.noDefault")}</p>
            )}
          </div>
        </Card>

        <Card title={t("app.network.purge.title")}>
          <div class="stack stack--tight">
            <p class="muted">{t("app.network.purge.body")}</p>
            <div class="row">
              <Button
                busy={purge.busy}
                icon={purge.done ? "check" : "broom"}
                onClick={() => void purge.run(() => call("network.purge"))}
                size="xs"
                variant="secondary"
              >
                {t("app.network.purge.action")}
              </Button>
            </div>
            {purge.done ? (
              <p class="muted" role="status">
                {t("app.network.purge.done")}
              </p>
            ) : null}
            {purge.error ? <Failure error={purge.error} /> : null}
          </div>
        </Card>
      </div>

      <Card title={t("app.network.domains.custom")}>
        <form
          class="stack stack--tight"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <p class="muted">{t("app.network.domains.customBody")}</p>
          {info.custom ? (
            <div class="row row--between net-domain">
              <span class="row">
                <Icon name="globe" />
                <Copyable label={t("app.network.copy")} text={info.custom} />
              </span>
              <Button
                icon="trash"
                onClick={() => {
                  remove.clear();
                  setRemoving(true);
                }}
                size="xs"
                variant="ghost"
              >
                {t("app.network.domains.remove")}
              </Button>
            </div>
          ) : null}
          <div class="net-form">
            <Input
              aria-label={t("app.network.domains.custom")}
              autoComplete="off"
              class="mono"
              invalid={Boolean(error)}
              onInput={(event) => {
                setTyped(event.currentTarget.value);
                setSaved(undefined);
              }}
              placeholder={t("app.network.domains.placeholder")}
              spellcheck={false}
              value={typed}
            />
            <Button busy={save.busy} disabled={!domain} size="sm" type="submit">
              {t("app.network.domains.save")}
            </Button>
          </div>
          {error ? <p class="field-error">{error}</p> : null}
          {domain && domain !== typed.trim().toLowerCase() ? (
            <p class="muted">
              {t("app.network.domains.savedAs")}{" "}
              <span class="mono">{domain}</span>
            </p>
          ) : null}
          {saved ? (
            <p class="muted" role="status">
              {t("app.network.domains.saved", { DOMAIN: saved })}
            </p>
          ) : null}
          {save.error ? <Failure error={save.error} /> : null}
        </form>
      </Card>

      {info.custom ? <DnsRecords domain={info.custom} /> : null}

      <Dialog
        busy={remove.busy}
        cancelLabel={t("panel.cancel")}
        confirmLabel={t("app.network.domains.remove")}
        danger
        description={t("app.network.domains.removeBody", {
          DOMAIN: info.custom ?? "",
        })}
        onClose={() => setRemoving(false)}
        onConfirm={() =>
          void remove.run(async () => {
            await call("network.domain", { domain: "@" });
            setRemoving(false);
            onChanged();
          })
        }
        open={removing}
        title={t("app.network.domains.removeTitle")}
      >
        {remove.error ? <Failure error={remove.error} /> : null}
      </Dialog>
    </div>
  );
}

function DnsRecords({ domain }: { domain: string }) {
  const dns = useRpc<Record_[]>("network.dns", undefined, domain);
  const records = dns.data ?? [];
  const pending = dnsPending(dns.data, dns.error);

  // Records appear and validate on the edge's schedule: look again.
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(dns.reload, DNS_POLL_MS);
    return () => clearInterval(timer);
  }, [pending, dns.reload]);

  const columns: Column<Record_>[] = [
    {
      key: "type",
      label: t("app.network.dns.type"),
      width: "84px",
      render: (r) => (
        <Badge class="mono" size="sm">
          {r.type.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: "name",
      label: t("app.network.dns.name"),
      render: (r) => (
        <div class="dns-cell">
          <Copyable label={t("app.network.copy")} text={r.name} />
          <span class="dns-cell__role">
            {ROLE[dnsRole(r)]()}
            {r.fallback ? (
              <Badge size="sm" tone="primary">
                {t("app.network.dns.alternative")}
              </Badge>
            ) : null}
          </span>
        </div>
      ),
    },
    {
      key: "value",
      label: t("app.network.dns.value"),
      render: (r) => <Copyable label={t("app.network.copy")} text={r.value} />,
    },
    {
      key: "status",
      label: t("app.network.dns.status"),
      width: "30%",
      render: (r) => {
        const [tone, word] = recordStatus(r.status);
        return (
          <div class="dns-cell">
            <StatusDot label={word} tone={tone} />
            {r.errors?.length ? (
              <div class="dns-cell__errors">
                <span>{t("app.network.dns.reason")}</span>
                <ul>
                  {r.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <Card
      actions={
        <IconButton
          busy={dns.loading}
          icon="arrow-clockwise"
          label={t("command.refresh")}
          onClick={dns.reload}
        />
      }
      title={t("app.network.dns.title")}
    >
      <div class="stack stack--tight">
        <p class="muted">{t("app.network.dns.body")}</p>
        {dns.error ? <Failure error={dns.error} onRetry={dns.reload} /> : null}
        {dns.error && !dns.data ? null : dns.data && !records.length ? (
          <Alert intent="info" title={t("app.network.dns.empty.title")}>
            {t("app.network.dns.empty.body")}
          </Alert>
        ) : (
          <Table
            columns={columns}
            empty={t("generic.loading")}
            label={t("app.network.dns.title")}
            rowKey={(r) => `${r.type}:${r.name}:${r.value}`}
            rows={records}
          />
        )}
        {records.some((r) => r.fallback) ? (
          <Alert intent="info" title={t("app.network.dns.fallback.title")}>
            {t("app.network.dns.fallback.body")}
          </Alert>
        ) : null}
      </div>
    </Card>
  );
}
