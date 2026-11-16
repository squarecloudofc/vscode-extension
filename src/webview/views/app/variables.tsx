import { useMemo, useState } from "preact/hooks";

import {
  Alert,
  Button,
  type Column,
  Dialog,
  EmptyState,
  IconButton,
  Input,
  Table,
} from "../../components";
import { NAV_ICON } from "../../icons";
import { locale, t } from "../../l10n";
import { ENV_KEY, parseEnv } from "../../lib/env";
import { call } from "../../rpc";
import { Failure, useRpc, useTask } from "../shared/rpc";

/** The names only: a value comes from the host when it's asked for. */
type Keys = string[];
type Row = { key: string };

const MASK = "••••••••••••";

/** An add or edit in progress; `key` is fixed when editing. */
type Draft = { key: string; value: string; existing: boolean };

export function VariablesTab() {
  const envs = useRpc<Keys>("envs");
  /** The values on screen, each read from the host on "Show". */
  const [shown, setShown] = useState<ReadonlyMap<string, string>>(new Map());
  const [copied, setCopied] = useState<string>();
  const [draft, setDraft] = useState<Draft>();
  const [removing, setRemoving] = useState<string>();
  const [pasted, setPasted] = useState<string>();
  const save = useTask();
  const imported = useTask();
  /** Show and copy: each asks the host, which may fail. */
  const peek = useTask();

  const rows = useMemo<Row[]>(
    () =>
      [...(envs.data ?? [])]
        .sort((a, b) => a.localeCompare(b))
        .map((key) => ({ key })),
    [envs.data],
  );
  const parsed = useMemo(
    () => (pasted === undefined ? undefined : parseEnv(pasted)),
    [pasted],
  );

  /** Hides the given variables' values (they changed, or went away). */
  const hide = (keys: readonly string[]) =>
    setShown((values) => {
      const next = new Map(values);
      for (const key of keys) next.delete(key);
      return next;
    });

  const write = (
    method: string,
    params: unknown,
    changed: readonly string[],
    close: () => void,
  ) =>
    void save.run(async () => {
      envs.set(await call<Keys>(method, params));
      hide(changed);
      close();
    });

  const toggle = (key: string) => {
    if (shown.has(key)) return hide([key]);
    void peek.run(async () => {
      const value = await call<string | null>("envs.reveal", { key });
      if (value !== null) setShown((values) => new Map(values).set(key, value));
    });
  };

  /** Opens the edit dialog, then fills in the current value from the host. */
  const edit = (key: string) => {
    save.clear();
    setDraft({ key, value: "", existing: true });
    void save.run(async () => {
      const value = await call<string | null>("envs.reveal", { key });
      setDraft((d) =>
        d?.key === key && !d.value ? { ...d, value: value ?? "" } : d,
      );
    });
  };

  const columns: Column<Row>[] = [
    { key: "key", label: t("app.envs.key"), mono: true, width: "34%" },
    {
      key: "value",
      label: t("app.envs.value"),
      mono: true,
      render: (row) => (
        <span class={shown.has(row.key) ? "env-value" : "env-value muted"}>
          {shown.get(row.key) ?? MASK}
        </span>
      ),
    },
    {
      key: "actions",
      label: <span class="visually-hidden">{t("panel.actions")}</span>,
      align: "end",
      width: "152px",
      render: (row) => (
        <span class="row row--end">
          <IconButton
            icon={shown.has(row.key) ? "eye-slash" : "eye"}
            label={shown.has(row.key) ? t("app.envs.hide") : t("app.envs.show")}
            onClick={() => toggle(row.key)}
          />
          <IconButton
            icon={copied === row.key ? "check" : "copy"}
            label={copied === row.key ? t("app.copied") : t("app.envs.copy")}
            onClick={() =>
              void peek.run(async () => {
                await call("envs.copy", { key: row.key });
                setCopied(row.key);
                setTimeout(
                  () => setCopied((k) => (k === row.key ? undefined : k)),
                  2000,
                );
              })
            }
          />
          <IconButton
            icon="pencil-simple"
            label={t("app.envs.edit")}
            onClick={() => edit(row.key)}
          />
          <IconButton
            icon="trash"
            label={t("app.envs.delete")}
            onClick={() => {
              save.clear();
              setRemoving(row.key);
            }}
          />
        </span>
      ),
    },
  ];

  const keyInvalid = Boolean(draft?.key) && !ENV_KEY.test(draft?.key ?? "");
  const count = parsed?.vars.length ?? 0;

  return (
    <section class="stack">
      <header class="section-head">
        <p class="muted">{t("app.envs.description")}</p>
        <div class="row">
          <Button
            busy={imported.busy}
            icon="upload-simple"
            onClick={() =>
              void imported.run(async () => {
                const text = await call<string | null>("envs.import");
                if (text !== null) {
                  save.clear();
                  setPasted(text);
                }
              })
            }
            size="xs"
            variant="ghost"
          >
            {t("app.envs.import")}
          </Button>
          <Button
            icon="brackets-curly"
            onClick={() => {
              save.clear();
              setPasted("");
            }}
            size="xs"
            variant="secondary"
          >
            {t("app.envs.paste")}
          </Button>
          <Button
            icon="plus"
            onClick={() => {
              save.clear();
              setDraft({ key: "", value: "", existing: false });
            }}
            size="xs"
          >
            {t("app.envs.add")}
          </Button>
        </div>
      </header>

      {imported.error ? <Failure error={imported.error} /> : null}
      {peek.error ? <Failure error={peek.error} /> : null}

      {envs.error && !envs.data ? (
        <Failure error={envs.error} onRetry={envs.reload} />
      ) : envs.data && !rows.length ? (
        <EmptyState
          description={t("app.envs.empty.body")}
          icon={NAV_ICON.env}
          title={t("app.envs.empty.title")}
        />
      ) : (
        <Table
          columns={columns}
          empty={t("generic.loading")}
          label={t("panel.tab.variables")}
          rowKey={(row) => row.key}
          rows={rows}
        />
      )}

      <Dialog
        busy={save.busy}
        cancelLabel={t("panel.cancel")}
        confirmLabel={t("app.envs.save")}
        onClose={() => setDraft(undefined)}
        onConfirm={() => {
          if (!draft || !ENV_KEY.test(draft.key)) return;
          write(
            "envs.set",
            { envs: { [draft.key]: draft.value } },
            [draft.key],
            () => setDraft(undefined),
          );
        }}
        open={Boolean(draft)}
        title={draft?.existing ? draft.key : t("app.envs.add")}
      >
        <div class="stack stack--tight">
          {draft?.existing ? null : (
            <div class="field-label">
              {t("app.envs.key")}
              <Input
                aria-label={t("app.envs.key")}
                autoComplete="off"
                class="mono"
                invalid={keyInvalid}
                onInput={(event) => {
                  const key = event.currentTarget.value.trim();
                  setDraft((d) => d && { ...d, key });
                }}
                placeholder="KEY"
                spellcheck={false}
                value={draft?.key ?? ""}
              />
            </div>
          )}
          {keyInvalid ? (
            <p class="field-error">{t("envs.invalidKey")}</p>
          ) : null}
          <div class="field-label">
            {t("app.envs.value")}
            <Input
              aria-label={t("app.envs.value")}
              autoComplete="off"
              class="mono"
              onInput={(event) => {
                const value = event.currentTarget.value;
                setDraft((d) => d && { ...d, value });
              }}
              spellcheck={false}
              value={draft?.value ?? ""}
            />
          </div>
          {save.error ? <Failure error={save.error} /> : null}
        </div>
      </Dialog>

      <Dialog
        busy={save.busy}
        cancelLabel={t("panel.cancel")}
        confirmLabel={t("app.envs.delete")}
        danger
        description={t("app.envs.deleteBody")}
        onClose={() => setRemoving(undefined)}
        onConfirm={() =>
          removing &&
          write("envs.delete", { keys: [removing] }, [removing], () =>
            setRemoving(undefined),
          )
        }
        open={Boolean(removing)}
        title={t("app.envs.deleteTitle", { KEY: removing ?? "" })}
      >
        {save.error ? <Failure error={save.error} /> : null}
      </Dialog>

      <Dialog
        busy={save.busy}
        cancelLabel={t("panel.cancel")}
        confirmLabel={t("app.envs.save")}
        description={t("app.envs.pasteBody")}
        onClose={() => setPasted(undefined)}
        onConfirm={() => {
          if (!parsed?.vars.length) return;
          write(
            "envs.set",
            { envs: Object.fromEntries(parsed.vars) },
            parsed.vars.map(([key]) => key),
            () => setPasted(undefined),
          );
        }}
        open={pasted !== undefined}
        title={t("app.envs.paste")}
      >
        <div class="stack stack--tight">
          <textarea
            aria-label={t("app.envs.paste")}
            class="textarea mono"
            onInput={(event) => setPasted(event.currentTarget.value)}
            placeholder={"DATABASE_URL=postgres://…\nNODE_ENV=production"}
            rows={8}
            spellcheck={false}
            value={pasted ?? ""}
          />
          {count ? (
            <p class="muted">
              {new Intl.PluralRules(locale()).select(count) === "one"
                ? t("app.envs.foundOne", { COUNT: count })
                : t("app.envs.found", { COUNT: count })}
            </p>
          ) : null}
          {parsed?.skipped.length ? (
            <Alert intent="warning">
              {t("app.envs.skipped", { LINES: parsed.skipped.join(", ") })}
            </Alert>
          ) : null}
          {save.error ? <Failure error={save.error} /> : null}
        </div>
      </Dialog>
    </section>
  );
}
