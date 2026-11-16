import { useState } from "preact/hooks";

import type { DatabaseInfo } from "../../protocol";
import { Button, Card, Dialog, Input } from "../../components";
import { locale, t } from "../../l10n";
import { isDatabaseName, memoryProblem } from "../../lib/database";
import { formatBytesParts } from "../../lib/format";
import { call } from "../../rpc";
import { Failure, useTask } from "../shared/rpc";

const MEMORY_ERROR = {
  integer: () => t("database.panel.memoryInteger"),
  low: (min: number) => t("database.panel.memoryLow", { MIN: min }),
  high: (_: number, max: number | null) =>
    t("database.panel.memoryHigh", { MAX: max ?? 0 }),
};

export function SettingsTab({
  info,
  onSaved,
}: {
  info: DatabaseInfo;
  /** Read `info` again: the header shows the new name or memory. */
  onSaved(): void;
}) {
  const [name, setName] = useState(info.name);
  const [ram, setRam] = useState(String(info.ram));
  const [confirming, setConfirming] = useState(false);
  const rename = useTask();
  const memory = useTask();
  const remove = useTask();

  const nameInvalid = !isDatabaseName(name.trim());
  const problem = memoryProblem(ram, info.ramMin, info.ramMax);
  const save = (task: typeof rename, method: string, params: object) =>
    void task.run(async () => {
      await call(method, params);
      onSaved();
    });

  return (
    <section class="stack settings">
      <Card title={t("database.panel.name")}>
        <form
          class="stack stack--tight"
          onSubmit={(event) => {
            event.preventDefault();
            if (!nameInvalid && name.trim() !== info.name)
              save(rename, "rename", { name });
          }}
        >
          <p class="muted">{t("database.panel.nameBody")}</p>
          <div class="form-row">
            <Input
              aria-label={t("database.panel.name")}
              autoComplete="off"
              class="form-row__grow"
              invalid={nameInvalid}
              maxLength={32}
              onInput={(event) => setName(event.currentTarget.value)}
              spellcheck={false}
              value={name}
            />
            <Button
              busy={rename.busy}
              disabled={nameInvalid || name.trim() === info.name}
              icon={rename.done ? "check" : undefined}
              type="submit"
              variant="secondary"
            >
              {rename.done ? t("app.logs.saved") : t("app.envs.save")}
            </Button>
          </div>
          {nameInvalid ? (
            <p class="field-error">{t("database.panel.nameInvalid")}</p>
          ) : null}
          {rename.error ? <Failure error={rename.error} /> : null}
        </form>
      </Card>

      <Card title={t("database.panel.memory")}>
        <form
          class="stack stack--tight"
          onSubmit={(event) => {
            event.preventDefault();
            if (!problem && Number(ram) !== info.ram)
              save(memory, "memory", { ram });
          }}
        >
          <p class="muted">{t("database.panel.memoryBody")}</p>
          <div class="form-row">
            <Input
              aria-label={t("database.panel.memory")}
              autoComplete="off"
              class="form-row__grow mono"
              end={
                <span class="muted">
                  {formatBytesParts(1024 ** 2, locale()).unit}
                </span>
              }
              inputMode="numeric"
              invalid={Boolean(problem)}
              onInput={(event) => setRam(event.currentTarget.value)}
              value={ram}
            />
            <Button
              busy={memory.busy}
              disabled={Boolean(problem) || Number(ram) === info.ram}
              icon={memory.done ? "check" : undefined}
              type="submit"
              variant="secondary"
            >
              {memory.done ? t("app.logs.saved") : t("app.envs.save")}
            </Button>
          </div>
          <p class={problem ? "field-error" : "muted"}>
            {problem
              ? MEMORY_ERROR[problem](info.ramMin, info.ramMax)
              : info.ramMax !== null
                ? t("database.panel.memoryRange", {
                    MIN: info.ramMin,
                    MAX: info.ramMax,
                  })
                : null}
          </p>
          {memory.error ? <Failure error={memory.error} /> : null}
        </form>
      </Card>

      <Card class="card--danger" title={t("database.delete")}>
        <div class="stack stack--tight">
          <p class="muted">{t("database.panel.deleteBody")}</p>
          {remove.error ? <Failure error={remove.error} /> : null}
          <div class="row">
            <Button
              busy={remove.busy}
              icon="trash"
              onClick={() => setConfirming(true)}
              size="xs"
              variant="danger"
            >
              {t("database.delete")}
            </Button>
          </div>
        </div>
      </Card>

      <Dialog
        busy={remove.busy}
        cancelLabel={t("panel.cancel")}
        confirmLabel={t("database.delete")}
        confirmPrompt={t("app.settings.deletePrompt", { NAME: info.name })}
        confirmText={info.name}
        danger
        description={t("database.panel.deleteConfirm", { NAME: info.name })}
        onClose={() => setConfirming(false)}
        onConfirm={() =>
          void remove.run(async () => {
            await call("delete");
            setConfirming(false);
          })
        }
        open={confirming}
        title={t("app.settings.deleteTitle", { NAME: info.name })}
      />
    </section>
  );
}
