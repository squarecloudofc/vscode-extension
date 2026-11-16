import { useState } from "preact/hooks";

import { Alert, Button, Card, Dialog } from "../../components";
import { t } from "../../l10n";
import { call } from "../../rpc";
import { Canceled, Failure, useTask } from "../shared/rpc";

export function SettingsTab({ name }: { name: string }) {
  const commit = useTask();
  const remove = useTask();
  const [restart, setRestart] = useState(true);
  const [kind, setKind] = useState<"file" | "folder">();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  const send = (picked: "file" | "folder") => {
    setKind(picked);
    void commit.run(async () => {
      if (!(await call<boolean>("commit", { kind: picked, restart })))
        throw new Canceled();
    });
  };

  return (
    <section class="stack settings">
      <Card title={t("app.settings.commit")}>
        <div class="stack stack--tight">
          <p class="muted">{t("app.settings.commitBody")}</p>
          <label class="check">
            <input
              checked={restart}
              onChange={(event) => setRestart(event.currentTarget.checked)}
              type="checkbox"
            />
            {t("app.settings.restart")}
          </label>
          <div class="row">
            <Button
              busy={commit.busy && kind === "file"}
              disabled={commit.busy}
              icon={commit.done && kind === "file" ? "check" : "file"}
              onClick={() => send("file")}
              size="xs"
              variant="secondary"
            >
              {t("app.settings.files")}
            </Button>
            <Button
              busy={commit.busy && kind === "folder"}
              disabled={commit.busy}
              icon={commit.done && kind === "folder" ? "check" : "folder"}
              onClick={() => send("folder")}
              size="xs"
              variant="secondary"
            >
              {t("app.settings.folder")}
            </Button>
            {commit.done ? (
              <span class="muted" role="status">
                {t("app.settings.committed")}
              </span>
            ) : null}
          </div>
          {commit.error ? <Failure error={commit.error} /> : null}
        </div>
      </Card>

      <Card class="card--danger" title={t("app.settings.delete")}>
        <div class="stack stack--tight">
          <p class="muted">{t("app.settings.deleteBody")}</p>
          {pending ? (
            <Alert intent="warning">{t("delete.snapshotPending")}</Alert>
          ) : null}
          {remove.error ? <Failure error={remove.error} /> : null}
          <div class="row">
            <Button
              busy={remove.busy}
              icon="trash"
              onClick={() => setConfirming(true)}
              size="xs"
              variant="danger"
            >
              {t("app.settings.deleteAction")}
            </Button>
          </div>
        </div>
      </Card>

      <Dialog
        busy={remove.busy}
        cancelLabel={t("panel.cancel")}
        confirmLabel={t("app.settings.deleteAction")}
        confirmPrompt={t("app.settings.deletePrompt", { NAME: name })}
        confirmText={name}
        danger
        description={t("app.settings.deleteConfirm", { NAME: name })}
        onClose={() => setConfirming(false)}
        onConfirm={() =>
          void remove.run(async () => {
            const result = await call<{ pending: boolean }>("delete");
            setConfirming(false);
            setPending(result.pending);
          })
        }
        open={confirming}
        title={t("app.settings.deleteTitle", { NAME: name })}
      />
    </section>
  );
}
