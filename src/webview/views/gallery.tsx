import { useState } from "preact/hooks";

import {
  Alert,
  Badge,
  Button,
  Card,
  Chart,
  type Column,
  Console,
  type ConsoleLine,
  Dialog,
  EmptyState,
  IconButton,
  Input,
  Menu,
  Select,
  Skeleton,
  Sparkline,
  Stat,
  StatGrid,
  StatusDot,
  Table,
  Tabs,
  Tooltip,
  UsageBar,
} from "../components";
import { NAV_ICON } from "../icons";
import { locale } from "../l10n";
import { niceByteTicks } from "../lib/chart";
import { formatBytes, formatPercent } from "../lib/format";

// The component gallery, for scripts/preview only (no command opens it): every
// component in the states the panels use, on mock data the preview sends.
// The sidebar has its own preview (scripts/preview/index.html?view=sidebar).
// Its copy is English on purpose; it is never shown to users.

type Env = { key: string; value: string };
type Snapshot = { id: string; created: string; size: number };

type GalleryState = {
  cpu?: number[];
  metrics?: { t: number; cpu: number; ram: number }[];
  logs?: ConsoleLine[];
  envs?: Env[];
  snapshots?: Snapshot[];
};

const SECTIONS = [
  { id: "overview", label: "Overview", icon: NAV_ICON.applications },
  { id: "metrics", label: "Metrics", icon: NAV_ICON.metrics },
  { id: "logs", label: "Logs", icon: NAV_ICON.logs },
  { id: "deploys", label: "Deploys", icon: NAV_ICON.deploys },
  { id: "env", label: "Variables", icon: NAV_ICON.env },
  { id: "files", label: "Files", icon: NAV_ICON.files },
  { id: "snapshots", label: "Snapshots", icon: NAV_ICON.snapshots },
  { id: "network", label: "Network", icon: NAV_ICON.network },
  { id: "settings", label: "Settings", icon: NAV_ICON.settings },
];

const time = (t: number) =>
  new Date(t).toLocaleTimeString(locale(), {
    hour: "2-digit",
    minute: "2-digit",
  });

export function Gallery({ state }: { state: GalleryState | undefined }) {
  const lang = locale();
  const [section, setSection] = useState("overview");
  const [range, setRange] = useState("24h");
  const [confirming, setConfirming] = useState(false);
  const [shown, setShown] = useState<string[]>([]);
  const metrics = state?.metrics ?? [];
  const MB = 1024 ** 2;

  const envColumns: Column<Env>[] = [
    { key: "key", label: "Key", mono: true, width: "34%" },
    {
      key: "value",
      label: "Value",
      mono: true,
      render: (row) => (shown.includes(row.key) ? row.value : "••••••••••••"),
    },
    {
      key: "actions",
      label: <span class="visually-hidden">Actions</span>,
      align: "end",
      width: "120px",
      render: (row) => (
        <span class="row row--end">
          <IconButton
            icon={shown.includes(row.key) ? "eye-slash" : "eye"}
            label={shown.includes(row.key) ? "Hide value" : "Show value"}
            onClick={() =>
              setShown((keys) =>
                keys.includes(row.key)
                  ? keys.filter((k) => k !== row.key)
                  : [...keys, row.key],
              )
            }
          />
          <IconButton icon="copy" label="Copy value" />
          <IconButton icon="trash" label="Delete variable" />
        </span>
      ),
    },
  ];

  const snapshotColumns: Column<Snapshot>[] = [
    { key: "created", label: "Created", mono: true },
    {
      key: "size",
      label: "Size",
      mono: true,
      align: "end",
      render: (row) => formatBytes(row.size, lang, 1),
    },
    {
      key: "actions",
      label: <span class="visually-hidden">Actions</span>,
      align: "end",
      width: "96px",
      render: () => (
        <span class="row row--end">
          <IconButton icon="download-simple" label="Download" />
          <IconButton icon="clock-counter-clockwise" label="Restore" />
        </span>
      ),
    },
  ];

  return (
    <div class="gallery">
      <main class="page">
        <header class="page__head">
          <div class="page__identity">
            <span class="page__logo mono">js</span>
            <div class="page__names">
              <div class="row">
                <h1 class="page__title">my-bot</h1>
                <StatusDot label="Online" tone="green" />
              </div>
              <p class="page__meta mono">
                <span>a1b2c3d4</span>
                <span>Node.js</span>
                <span>512 MB</span>
                <span>my-bot.squareweb.app</span>
              </p>
            </div>
          </div>
          <div class="row">
            <IconButton disabled icon="play" label="Start" />
            <IconButton icon="arrow-clockwise" label="Restart" />
            <IconButton icon="square" label="Stop" />
            <Button icon="arrow-square-out" size="xs" variant="secondary">
              Open
            </Button>
            <Menu
              items={[
                { group: "App" },
                { label: "Copy ID", icon: "copy", onSelect: () => {} },
                {
                  label: "Open in browser",
                  icon: "arrow-square-out",
                  onSelect: () => {},
                },
                "separator",
                { group: "Deploy" },
                {
                  label: "Commit a folder",
                  icon: "upload-simple",
                  onSelect: () => {},
                },
                {
                  label: "Link GitHub",
                  icon: "github-logo",
                  onSelect: () => {},
                },
                "separator",
                {
                  label: "Delete app",
                  icon: "trash",
                  danger: true,
                  onSelect: () => setConfirming(true),
                },
              ]}
              label="More actions"
            />
          </div>
        </header>

        <Tabs
          items={SECTIONS}
          label="App sections"
          onChange={setSection}
          value={section}
        />

        <StatGrid>
          <Stat
            label="CPU"
            value={formatPercent(state?.cpu?.at(-1) ?? 0, lang)}
          >
            <Sparkline data={state?.cpu ?? []} floor={5} />
          </Stat>
          <Stat hint="23% of the limit" label="RAM" unit="/ 512 MB" value="120">
            <UsageBar percent={23} />
          </Stat>
          <Stat label="Network" unit="kB/s" value="↓ 1.2 ↑ 0.3" />
          <Stat label="Storage" unit="MB" value="84" />
        </StatGrid>

        <div class="grid-2">
          <Card
            actions={
              <Tabs
                items={[
                  { id: "24h", label: "24 h" },
                  {
                    id: "7d",
                    label: "7 d",
                    disabled: true,
                    title: "Your plan keeps 24 hours of metrics",
                  },
                ]}
                label="Range"
                onChange={setRange}
                value={range}
                variant="pill"
              />
            }
            title="CPU"
          >
            <Chart
              data={metrics}
              label="CPU over the last 24 hours"
              series={[{ key: "cpu", name: "CPU", color: "var(--sq-chart-1)" }]}
              x="t"
              xFormat={time}
              valueFormat={(v) => formatPercent(v, lang, 2)}
              yFormat={(v) => formatPercent(v, lang, 0)}
            />
          </Card>
          <Card title="RAM">
            <Chart
              data={metrics.map((row) => ({ ...row, ram: row.ram * MB }))}
              label="RAM over the last 24 hours"
              series={[{ key: "ram", name: "RAM", color: "var(--sq-chart-2)" }]}
              ticks={niceByteTicks}
              type="line"
              x="t"
              xFormat={time}
              valueFormat={(v) => formatBytes(v, lang, 1)}
              yFormat={(v) => formatBytes(v, lang, 0)}
            />
          </Card>
        </div>

        <Card title="Buttons">
          <div class="stack">
            <div class="row">
              <Button icon="rocket">Deploy</Button>
              <Button variant="secondary">Open</Button>
              <Button variant="ghost">Cancel</Button>
              <Button icon="trash" variant="danger">
                Delete
              </Button>
              <Button disabled>Disabled</Button>
              <Button busy variant="secondary">
                Restarting
              </Button>
            </div>
            <div class="row">
              <Button size="md">Medium 40</Button>
              <Button size="sm">Small 36</Button>
              <Button size="xs">Extra small 32</Button>
              <IconButton icon="magnifying-glass" label="Search" />
              <IconButton icon="plus" label="Add" variant="secondary" />
              <IconButton icon="pencil-simple" label="Rename" size="md" />
            </div>
          </div>
        </Card>

        <div class="grid-2">
          <Card title="Status">
            <div class="stack">
              <div class="row row--wide">
                <StatusDot label="Online" tone="green" />
                <StatusDot label="Offline" tone="red" />
                <StatusDot label="Starting" tone="amber" />
                <StatusDot label="Deploying" tone="blue" />
                <StatusDot label="Unknown" tone="muted" />
              </div>
              <div class="row">
                <Badge tone="purple">Pro</Badge>
                <Badge tone="primary">Standard</Badge>
                <Badge tone="success">Active</Badge>
                <Badge tone="warning">Pending</Badge>
                <Badge tone="danger">Failed</Badge>
                <Badge>PostgreSQL 18</Badge>
                <Badge size="sm" tone="outline">
                  sm
                </Badge>
              </div>
              <div class="stack stack--tight">
                <UsageBar percent={42} />
                <UsageBar percent={86} />
                <UsageBar percent={97} />
              </div>
            </div>
          </Card>
          <Card title="Inputs">
            <div class="stack">
              <Input icon="magnifying-glass" placeholder="Filter apps" />
              <Input invalid value="my bot" />
              <div class="row">
                <Select
                  aria-label="Memory"
                  options={[
                    { value: "512", label: "512 MB" },
                    { value: "1024", label: "1 GB" },
                    { value: "2048", label: "2 GB" },
                  ]}
                />
                <Tooltip content="Copies the connection URL">
                  <Button icon="link" variant="secondary">
                    Connection
                  </Button>
                </Tooltip>
              </div>
            </div>
          </Card>
        </div>

        <Card flush title="Variables">
          <Table
            class="table-wrap--flush"
            columns={envColumns}
            label="Environment variables"
            rowKey={(row) => row.key}
            rows={state?.envs ?? []}
          />
        </Card>

        <div class="stack">
          <Alert intent="info" title="Metrics cover 24 hours">
            Your plan keeps 24 hours of history, so 7 days shows the same
            window.
          </Alert>
          <Alert
            action={
              <Button size="xs" variant="secondary">
                Reconnect
              </Button>
            }
            intent="warning"
            title="Reconnect to unlock files"
          >
            Your key was created before file access existed. Reconnect to let VS
            Code read and write this app's files.
          </Alert>
          <Alert intent="success" title="Snapshot created" />
          <Alert intent="danger" title="Deploy failed">
            The build exited with code 1. Check the logs for the first error.
          </Alert>
        </div>

        <Card title="Logs">
          <Console
            empty="Waiting for the first line"
            height={260}
            label="Application logs"
            lines={state?.logs ?? []}
          />
        </Card>

        <div class="grid-2">
          <Card flush title="Snapshots">
            <Table
              class="table-wrap--flush"
              columns={snapshotColumns}
              empty="No snapshots yet"
              label="Snapshots"
              rowKey={(row) => row.id}
              rows={state?.snapshots ?? []}
            />
          </Card>
          <EmptyState
            action={
              <Button icon="plus" size="xs" variant="secondary">
                Create snapshot
              </Button>
            }
            description="Snapshots you create appear here. You can restore or download any of them."
            icon="clock-counter-clockwise"
            title="No snapshots yet"
          />
        </div>

        <Card title="Loading">
          <div class="stack">
            <Skeleton height={20} width="40%" />
            <div class="row row--fill">
              <Skeleton col={0} height={72} />
              <Skeleton col={1} height={72} />
              <Skeleton col={2} height={72} />
            </div>
          </div>
        </Card>

        <Dialog
          cancelLabel="Cancel"
          confirmLabel="Delete app"
          confirmPrompt={
            <>
              Type <span class="mono">my-bot</span> to confirm
            </>
          }
          confirmText="my-bot"
          danger
          description="This deletes my-bot and its files. A recovery snapshot is saved first."
          onClose={() => setConfirming(false)}
          onConfirm={() => setConfirming(false)}
          open={confirming}
          title="Delete my-bot"
        />
      </main>
    </div>
  );
}
