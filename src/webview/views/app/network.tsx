import { useState } from "preact/hooks";

import type { AppInfo, NetworkSection } from "../../protocol";
import { Button, EmptyState, IconButton, Input, Tabs } from "../../components";
import { Icon } from "../../components/icon";
import { NAV_ICON, type NavIconName } from "../../icons";
import { locale, t } from "../../l10n";
import {
  FILTER_KEYS,
  type FilterKey,
  type Filters,
  PRESETS,
  type Preset,
  presetWindow,
  validWindow,
  type Window,
} from "../../lib/network";
import { call, RpcError } from "../../rpc";
import { AnalyticsSection } from "./network-analytics";
import { DomainsSection } from "./network-domains";
import { ErrorsSection, LogsSection, PerformanceSection } from "./network-edge";

// The Network tab: the site's Analytics pages (traffic, access logs,
// errors, performance) and its Network settings (domains, DNS, cache), as
// sections over one time range. The host side is src/panels/app/network.ts.

/** What a section reads: the window, and a key that changes on refresh. */
export type Query = Window & { key: string };

const SECTIONS: Record<
  NetworkSection,
  { icon: NavIconName; label: () => string; description: () => string }
> = {
  analytics: {
    icon: NAV_ICON.metrics,
    label: () => t("app.network.section.analytics"),
    description: () => t("app.network.analytics.description"),
  },
  domains: {
    icon: NAV_ICON.domains,
    label: () => t("app.network.section.domains"),
    description: () => t("app.network.domains.description"),
  },
  logs: {
    icon: NAV_ICON.logs,
    label: () => t("app.network.section.logs"),
    description: () => t("app.network.logs.description"),
  },
  errors: {
    icon: NAV_ICON.errors,
    label: () => t("app.network.section.errors"),
    description: () => t("app.network.errors.description"),
  },
  performance: {
    icon: NAV_ICON.performance,
    label: () => t("app.network.section.performance"),
    description: () => t("app.network.performance.description"),
  },
};

const PRESET_TITLE: Record<Preset, () => string> = {
  "1h": () => t("app.network.range.1h"),
  "24h": () => t("app.network.range.24h"),
  "3d": () => t("app.network.range.3d"),
  "7d": () => t("app.network.range.7d"),
};

export const FILTER_LABEL: Record<FilterKey, () => string> = {
  country: () => t("app.network.filter.country"),
  path: () => t("app.network.filter.path"),
  referer: () => t("app.network.filter.referer"),
  provider: () => t("app.network.filter.provider"),
  browser: () => t("app.network.filter.browser"),
  os: () => t("app.network.filter.os"),
  protocol: () => t("app.network.filter.protocol"),
  status: () => t("app.network.filter.status"),
  content_type: () => t("app.network.filter.content_type"),
};

/** "1h", "24h", "3d", "7d" in the UI language, from Intl (no strings). */
function presetLabel(preset: Preset, lang: string): string {
  const [n, unit] =
    preset === "1h"
      ? [1, "hour"]
      : preset === "24h"
        ? [24, "hour"]
        : [Number.parseInt(preset, 10), "day"];
  return new Intl.NumberFormat(lang, {
    style: "unit",
    unit,
    unitDisplay: "narrow",
  }).format(n);
}

/** A country code as its name; the edge's T1 and XX have their own. */
export function countryName(code: string | null, lang: string): string {
  if (!code || code === "XX") return t("app.network.unknownOrigin");
  if (code === "T1") return t("app.network.tor");
  try {
    return new Intl.DisplayNames(lang, { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** A plan without this section: what it gives, and the way to it. */
export function Paywall({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: NavIconName;
}) {
  return (
    <EmptyState
      action={
        <Button
          icon="arrow-square-out"
          onClick={() => void call("open", { target: "pricing" })}
          size="xs"
          variant="secondary"
        >
          {t("problem.plan.action")}
        </Button>
      }
      description={
        <>
          {body} <span class="muted">{t("app.network.plan")}</span>
        </>
      }
      icon={icon}
      title={title}
    />
  );
}

export const isUpgrade = (error: unknown) =>
  error instanceof RpcError && error.code === "UPGRADE_REQUIRED";

// <input type="datetime-local"> speaks local wall-clock time.
const toLocal = (ms: number) =>
  new Date(ms - new Date(ms).getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

export function NetworkTab({
  info,
  section,
  onSection,
  onInfoChanged,
  onOpenLogs,
}: {
  info: AppInfo;
  section: NetworkSection;
  onSection(section: NetworkSection): void;
  onInfoChanged(): void;
  onOpenLogs(): void;
}) {
  const lang = locale();
  const [range, setRange] = useState<Preset | "custom">("24h");
  const [span, setSpan] = useState<Window>(() =>
    presetWindow("24h", Date.now()),
  );
  const [round, setRound] = useState(0);
  const [draft, setDraft] = useState({ start: "", end: "" });
  const [draftError, setDraftError] = useState(false);
  const [filters, setFilters] = useState<Filters>({});

  if (!info.subdomain && !info.custom)
    return (
      <EmptyState
        action={
          <Button
            icon={NAV_ICON.logs}
            onClick={onOpenLogs}
            size="xs"
            variant="secondary"
          >
            {t("app.network.notWebsite.action")}
          </Button>
        }
        description={t("app.network.notWebsite.body")}
        icon={NAV_ICON.network}
        title={t("app.network.notWebsite.title")}
      />
    );

  const pick = (next: string) => {
    if (next === "custom") {
      setDraft({
        start: toLocal(Date.parse(span.start)),
        end: toLocal(Date.parse(span.end)),
      });
      setDraftError(false);
    } else setSpan(presetWindow(next as Preset, Date.now()));
    setRange(next as Preset | "custom");
  };
  const refresh = () => {
    if (range !== "custom") setSpan(presetWindow(range, Date.now()));
    setRound((n) => n + 1);
  };
  const apply = () => {
    const start = new Date(draft.start).getTime();
    const end = new Date(draft.end).getTime();
    const ok = validWindow(start, end, Date.now());
    setDraftError(!ok);
    if (ok)
      setSpan({
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
      });
  };

  const query: Query = {
    ...span,
    key: `${span.start}|${span.end}|${round}`,
  };
  const timed = section !== "domains";
  const active = FILTER_KEYS.flatMap((key) => {
    const value = filters[key];
    return value ? [[key, value] as const] : [];
  });
  const now = Date.now();

  return (
    <section class="stack">
      <header class="net-head">
        <Tabs
          items={(Object.keys(SECTIONS) as NetworkSection[]).map((id) => ({
            id,
            icon: SECTIONS[id].icon,
            label: SECTIONS[id].label(),
          }))}
          label={t("panel.tab.network")}
          onChange={(id) => onSection(id as NetworkSection)}
          value={section}
          variant="pill"
        />
        {timed ? (
          <div class="row">
            <IconButton
              icon="arrow-clockwise"
              label={t("command.refresh")}
              onClick={refresh}
            />
            <Tabs
              items={[
                ...(Object.keys(PRESETS) as Preset[]).map((id) => ({
                  id,
                  label: presetLabel(id, lang),
                  title: PRESET_TITLE[id](),
                })),
                { id: "custom", label: t("app.network.range.custom") },
              ]}
              label={t("app.network.range.label")}
              onChange={pick}
              value={range}
              variant="pill"
            />
          </div>
        ) : null}
      </header>

      <p class="muted net-lede">{SECTIONS[section].description()}</p>

      {timed && range === "custom" ? (
        <form
          class="net-custom"
          onSubmit={(event) => {
            event.preventDefault();
            apply();
          }}
        >
          <div class="field-label">
            {t("app.network.range.start")}
            <Input
              aria-label={t("app.network.range.start")}
              invalid={draftError}
              max={toLocal(now)}
              min={toLocal(now - PRESETS["7d"])}
              onInput={(event) =>
                setDraft((d) => ({ ...d, start: event.currentTarget.value }))
              }
              type="datetime-local"
              value={draft.start}
            />
          </div>
          <div class="field-label">
            {t("app.network.range.end")}
            <Input
              aria-label={t("app.network.range.end")}
              invalid={draftError}
              max={toLocal(now)}
              min={toLocal(now - PRESETS["7d"])}
              onInput={(event) =>
                setDraft((d) => ({ ...d, end: event.currentTarget.value }))
              }
              type="datetime-local"
              value={draft.end}
            />
          </div>
          <Button size="sm" type="submit" variant="secondary">
            {t("app.network.range.apply")}
          </Button>
          {draftError ? (
            <p class="field-error net-custom__error">
              {t("app.network.range.invalid")}
            </p>
          ) : null}
        </form>
      ) : null}

      {section === "analytics" ? (
        <>
          <div class="chips">
            {active.length ? (
              active.map(([key, value]) => (
                <span class="chip" key={key}>
                  <span class="chip__key">{FILTER_LABEL[key]()}</span>
                  <span class="chip__value">
                    {key === "country" ? countryName(value, lang) : value}
                  </span>
                  <button
                    aria-label={t("app.network.filters.remove", {
                      FILTER: FILTER_LABEL[key](),
                    })}
                    class="chip__remove"
                    onClick={() => {
                      const next = { ...filters };
                      delete next[key];
                      setFilters(next);
                    }}
                    type="button"
                  >
                    <Icon name="x" size={12} />
                  </button>
                </span>
              ))
            ) : (
              <span class="muted chips__hint">
                <Icon name="info" size={14} />
                {t("app.network.filters.hint")}
              </span>
            )}
            {active.length > 1 ? (
              <button
                class="link-button"
                onClick={() => setFilters({})}
                type="button"
              >
                {t("app.network.filters.clear")}
              </button>
            ) : null}
          </div>
          <AnalyticsSection
            filters={filters}
            onFilters={setFilters}
            query={query}
          />
        </>
      ) : section === "domains" ? (
        <DomainsSection info={info} onChanged={onInfoChanged} />
      ) : section === "logs" ? (
        <LogsSection query={query} />
      ) : section === "errors" ? (
        <ErrorsSection query={query} />
      ) : (
        <PerformanceSection query={query} />
      )}
    </section>
  );
}
