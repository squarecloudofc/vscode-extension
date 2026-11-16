import { useState } from "preact/hooks";

import type { SignInState } from "../protocol";
import { Alert, Button, IconButton, StatusDot } from "../components";
import { Icon, LogoMark } from "../components/icon";
import { locale, t } from "../l10n";
import { call } from "../rpc";

const time = (ms: number) =>
  new Date(ms).toLocaleTimeString(locale(), {
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Signed out, or reconnecting: the browser flow with the 8-character code,
 * or a pasted key. One primary action per step, nothing that loops except
 * the amber dot while the browser approval is pending.
 */
export function SignIn({ state }: { state: SignInState }) {
  return (
    <main class="sign-in">
      <header class="sign-in__brand">
        <LogoMark size={20} />
        <span>Square Cloud</span>
      </header>
      {state.step === "waiting" ? (
        <Waiting state={state} />
      ) : state.step === "error" ? (
        <Failed state={state} />
      ) : (
        <Choose state={state} />
      )}
    </main>
  );
}

function Choose({ state }: { state: SignInState }) {
  const starting = state.step === "starting";
  return (
    <>
      <div class="sign-in__intro">
        <h1 class="sign-in__title">{t("sidebar.signIn.title")}</h1>
        <p class="sign-in__lede">{t("sidebar.signIn.lede")}</p>
      </div>
      {state.notice ? <p class="sign-in__notice">{state.notice}</p> : null}
      <div class="sign-in__actions">
        <Button
          busy={starting}
          onClick={() => call("signIn.connect")}
          size="md"
          variant="primary"
        >
          {starting ? t("auth.preparing") : t("setApiKey.connect.label")}
        </Button>
        <button
          class="link-button"
          onClick={() => call("signIn.paste")}
          type="button"
        >
          {t("sidebar.signIn.paste")}
        </button>
        {state.reconnecting ? (
          <Button onClick={() => call("signIn.cancel")} variant="ghost">
            {t("setApiKey.panel.cancel")}
          </Button>
        ) : null}
      </div>
      <section class="sign-in__scopes">
        <h2 class="label">{t("sidebar.signIn.scopesTitle")}</h2>
        <ul>
          <li>
            <Icon class="sign-in__check" name="check" size={14} />
            {t("sidebar.signIn.scopes.read")}
          </li>
          <li>
            <Icon class="sign-in__check" name="check" size={14} />
            {t("sidebar.signIn.scopes.control")}
          </li>
          <li>
            <Icon class="sign-in__check" name="check" size={14} />
            {t("sidebar.signIn.scopes.files")}
          </li>
          <li>
            <Icon class="sign-in__check" name="check" size={14} />
            {t("sidebar.signIn.scopes.workspaces")}
          </li>
          <li>
            <Icon class="sign-in__check" name="check" size={14} />
            {t("sidebar.signIn.scopes.mcp")}
          </li>
        </ul>
        <p class="sign-in__fine">{t("auth.scopes.footer")}</p>
      </section>
      <p class="sign-in__fine">
        {t("auth.newHere")}{" "}
        <button
          class="link-button"
          onClick={() => call("run", { command: "getStarted" })}
          type="button"
        >
          {t("auth.tour")}
        </button>
      </p>
    </>
  );
}

function Waiting({ state }: { state: SignInState }) {
  const [copied, setCopied] = useState(false);
  const code = state.code ?? "";
  const copy = () => {
    void call("signIn.copy");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <>
      <div class="sign-in__code-block">
        <p class="label">{t("setApiKey.panel.codeLabel")}</p>
        <div class="sign-in__code-row">
          {/* Two groups of four read back more easily than eight in a row. */}
          <output aria-label={code} class="sign-in__code mono">
            <span>{code.slice(0, 4)}</span>
            <span>{code.slice(4)}</span>
          </output>
          <IconButton
            icon={copied ? "check" : "copy"}
            label={t("auth.copy")}
            onClick={copy}
          />
        </div>
        <p class="sign-in__fine">{t("setApiKey.connect.codeDetail")}</p>
      </div>
      <div class="sign-in__wait" role="status">
        <StatusDot label={t("setApiKey.panel.waitingHint")} tone="amber" />
        {state.expiresAt ? (
          <span class="sign-in__fine">
            {t("sidebar.signIn.expires", { TIME: time(state.expiresAt) })}
          </span>
        ) : null}
      </div>
      {state.warning ? (
        <Alert
          action={
            state.warning.keyLimit ? (
              <button
                class="link-button"
                onClick={() => call("signIn.security")}
                type="button"
              >
                {t("auth.warning.openSecurity")}
              </button>
            ) : undefined
          }
          intent="warning"
          title={state.warning.title}
        >
          {state.warning.body}
        </Alert>
      ) : null}
      <div class="sign-in__actions">
        <Button onClick={() => call("signIn.open")} size="md">
          {t("setApiKey.connect.open")}
          <Icon name="arrow-square-out" />
        </Button>
        <Button onClick={() => call("signIn.cancel")} variant="ghost">
          {t("setApiKey.panel.cancel")}
        </Button>
      </div>
    </>
  );
}

function Failed({ state }: { state: SignInState }) {
  return (
    <>
      <Alert intent="warning" title={state.error?.title}>
        {state.error?.body}
      </Alert>
      <div class="sign-in__actions">
        <Button onClick={() => call("signIn.connect")} size="md">
          {t("setApiKey.panel.retry")}
        </Button>
        <button
          class="link-button"
          onClick={() => call("signIn.paste")}
          type="button"
        >
          {t("sidebar.signIn.paste")}
        </button>
        {state.reconnecting ? (
          <Button onClick={() => call("signIn.cancel")} variant="ghost">
            {t("setApiKey.panel.cancel")}
          </Button>
        ) : null}
      </div>
    </>
  );
}
