import { useEffect, useRef, useState } from "preact/hooks";

import type { AppInfo, AppLive, StreamState } from "../../protocol";
import {
  Button,
  Card,
  Console,
  Sparkline,
  Stat,
  StatGrid,
  UsageBar,
} from "../../components";
import { locale, t } from "../../l10n";
import {
  formatBytes,
  formatBytesParts,
  formatDateTime,
  formatPercent,
} from "../../lib/format";
import { type Logs, StreamStatus } from "./logs";
import { runtimeName } from "./runtime";

/** Samples kept for the stat sparklines (about a minute while streaming). */
const SAMPLES = 60;
const MB = 1024 * 1024;

/** The last readings of one value, a new one each time `at` moves. */
function useSamples(value: number | undefined, at: number | undefined) {
  const [samples, setSamples] = useState<number[]>([]);
  const last = useRef(at);
  useEffect(() => {
    if (at === last.current || value === undefined) return;
    last.current = at;
    setSamples((s) => [...s.slice(1 - SAMPLES), value]);
  }, [at, value]);
  return samples;
}

export function OverviewTab({
  info,
  live,
  stream,
  logs,
  busy,
  onOpenLogs,
}: {
  info: AppInfo;
  live?: AppLive;
  stream?: StreamState;
  logs: Logs;
  /** An action is running: the readings stay, dimmed. */
  busy: boolean;
  onOpenLogs(): void;
}) {
  const lang = locale();
  const running = live?.running;
  const on = running === true;
  const cpu = useSamples(on ? live?.cpu : undefined, live?.at);
  const net = useSamples(
    on ? (live?.netIn ?? 0) + (live?.netOut ?? 0) : undefined,
    live?.at,
  );
  const limit = live?.ramLimit ?? info.ram;
  const used = live?.ramUsed;
  const percent = used !== undefined && limit ? (used / limit) * 100 : 0;
  const ram = formatBytesParts((used ?? 0) * MB, lang, 1);
  const storage =
    live?.storage != null ? formatBytesParts(live.storage, lang, 1) : undefined;
  const stopped = running === false ? t("app.stat.stopped") : undefined;
  const rate = (v = 0) => `${formatBytes(v, lang, 1)}/s`;

  return (
    <div class="stack">
      <div class="section-head">
        <h2 class="label">{t("app.usage")}</h2>
        <StreamStatus running={running} stream={stream} />
      </div>
      <StatGrid>
        <Stat
          dimmed={busy}
          hint={stopped}
          label={t("panel.metrics.cpu")}
          value={
            on && live?.cpu !== undefined ? formatPercent(live.cpu, lang) : "—"
          }
        >
          {on ? <Sparkline data={cpu} floor={5} /> : null}
        </Stat>
        <Stat
          dimmed={busy}
          hint={
            on && used !== undefined
              ? t("app.stat.ofLimit", {
                  PERCENT: formatPercent(percent, lang, 0),
                })
              : stopped
          }
          label={t("panel.metrics.ram")}
          unit={
            on && used !== undefined
              ? `${ram.unit} / ${formatBytes(limit * MB, lang, 1)}`
              : undefined
          }
          value={on && used !== undefined ? ram.value : "—"}
        >
          {on && used !== undefined ? <UsageBar percent={percent} /> : null}
        </Stat>
        <Stat
          dimmed={busy}
          hint={stopped}
          label={t("panel.metrics.network")}
          value={
            on ? (
              <span class="net-pair">
                <span>↓ {rate(live?.netIn)}</span>
                <span>↑ {rate(live?.netOut)}</span>
              </span>
            ) : (
              "—"
            )
          }
        >
          {on ? <Sparkline color="var(--sq-chart-2)" data={net} /> : null}
        </Stat>
        <Stat
          dimmed={busy}
          label={t("panel.metrics.storage")}
          unit={storage?.unit}
          value={storage?.value ?? "—"}
        />
      </StatGrid>

      <div class="overview-grid">
        <Card title={t("app.info.title")}>
          <dl class="facts">
            <dt>{t("app.info.runtime")}</dt>
            <dd>{runtimeName(info.lang)}</dd>
            <dt>{t("app.info.memory")}</dt>
            <dd class="mono">{formatBytes(info.ram * MB, lang, 1)}</dd>
            <dt>{t("app.info.cluster")}</dt>
            <dd class="mono">{info.cluster}</dd>
            {info.domain ? (
              <>
                <dt>{t("app.info.domain")}</dt>
                <dd class="mono facts__wrap">{info.domain}</dd>
              </>
            ) : null}
            {on && live?.uptime ? (
              <>
                <dt>{t("app.info.started")}</dt>
                <dd>{formatDateTime(live.uptime, lang)}</dd>
              </>
            ) : null}
            <dt>{t("app.info.created")}</dt>
            <dd>{formatDateTime(Date.parse(info.createdAt), lang)}</dd>
            <dt>{t("app.info.id")}</dt>
            <dd class="mono facts__wrap">{info.id}</dd>
          </dl>
          {info.desc ? <p class="facts__desc">{info.desc}</p> : null}
        </Card>
        <Card
          actions={
            <Button
              icon="arrow-right"
              onClick={onOpenLogs}
              size="xs"
              variant="ghost"
            >
              {t("app.logs.open")}
            </Button>
          }
          flush
          title={t("panel.tab.logs")}
        >
          <Console
            class="console--flush"
            empty={
              logs.history.loading ? t("generic.loading") : t("app.logs.empty")
            }
            height={268}
            label={t("app.logs.label")}
            lines={logs.lines.slice(-14)}
          />
        </Card>
      </div>
    </div>
  );
}
