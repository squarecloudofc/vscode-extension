import type {
  AppSummary,
  DatabaseSummary,
  RuntimeStats,
  StatusListItem,
  User,
  Workspace,
} from "@squarecloud/api";
import type { Disposable } from "vscode";
import { atom } from "xoid";

import type { ProblemKind } from "@/lib/utils/errors";

export interface ServiceStatus {
  status: string;
  message: string;
}

/**
 * What the extension knows about an app's state: the list endpoint gives
 * `running` (plus `cpu`/`ram` while running); opening a row adds the full
 * stats (`uptime`, `storage`, `network`).
 */
export type AppStatus = StatusListItem & Partial<RuntimeStats>;

/** Why the last account refresh failed; cleared by the next one that works. */
export interface Problem {
  kind: ProblemKind;
  code: string;
  at: number;
  /** When background polling resumes after a rate limit, if it is paused. */
  retryAt?: number;
}

export interface ExtensionStore {
  applications: Map<string, AppSummary>;
  statuses: Map<string, AppStatus>;
  favorited: Set<string>;
  workspaces: Workspace[];
  databases: Map<string, DatabaseSummary>;
  serviceStatus?: ServiceStatus;
  user?: User;
  appsLoaded: boolean;
  problem?: Problem;
  /** When the account last refreshed successfully. */
  lastUpdated?: number;
}

export interface ExtensionStoreActions {
  setApplications(applications: AppSummary[]): void;
  setStatuses(statuses: AppStatus[]): void;
  setStatus(status: AppStatus): void;
  setFavorited(applicationsId: string[]): void;
  toggleFavorite(applicationId: string, value?: boolean): void;

  setWorkspaces(workspaces: Workspace[]): void;
  setDatabases(databases: DatabaseSummary[]): void;
  setServiceStatus(status?: ServiceStatus): void;

  getStatus(applicationId: string): AppStatus | undefined;
  isFavorited(applicationId: string): boolean;

  setUser(user?: User): void;
  setAppsLoaded(value: boolean): void;
  setProblem(problem?: Problem): void;
  setLastUpdated(at?: number): void;
}

export const $extensionStore = atom<ExtensionStore, ExtensionStoreActions>(
  {
    applications: new Map(),
    statuses: new Map(),
    favorited: new Set(),
    workspaces: [],
    databases: new Map(),
    serviceStatus: undefined,
    user: undefined,
    appsLoaded: false,
  },
  (atom) => ({
    setApplications: (applications) => {
      const map = new Map(applications.map((app) => [app.id, app]));

      atom.update((value) => ({ ...value, applications: map }));
    },
    setStatus: (status) => {
      // Build a new Map so the reference changes — `selectAndSubscribe`
      // compares slices with `===`, and mutating in place left the reference
      // stable, which meant tree views never refreshed on status updates.
      const map = new Map(atom.value.statuses);
      map.set(status.id, status);
      atom.update((value) => ({ ...value, statuses: map }));
    },
    setStatuses: (statuses) => {
      // The list carries running, CPU and RAM only. An opened row's full
      // status (uptime, storage, network) survives the poll while the app
      // keeps running; the poll then re-reads opened rows, which catches a
      // restart made somewhere else.
      const previous = atom.value.statuses;
      const map = new Map(
        statuses.map((status) => {
          const full = previous.get(status.id);
          const kept = full?.running && status.running;
          return [status.id, kept ? { ...full, ...status } : status];
        }),
      );

      atom.update((value) => ({ ...value, statuses: map }));
    },

    setFavorited: (applicationsId) => {
      atom.update((value) => ({
        ...value,
        favorited: new Set(applicationsId),
      }));
    },
    toggleFavorite: (applicationId, value) => {
      // Clone the Set so selectAndSubscribe sees a new reference.
      const favorited = new Set(atom.value.favorited);
      const isFavorited = favorited.has(applicationId);
      const toFavorite = value !== undefined ? value : !isFavorited;
      favorited[toFavorite ? "add" : "delete"](applicationId);
      atom.update((value) => ({ ...value, favorited }));
    },

    setWorkspaces: (workspaces) => {
      atom.update((value) => ({ ...value, workspaces }));
    },
    setDatabases: (databases) => {
      const map = new Map(databases.map((db) => [db.id, db]));
      atom.update((value) => ({ ...value, databases: map }));
    },
    setServiceStatus: (status) => {
      atom.update((value) => ({ ...value, serviceStatus: status }));
    },

    getStatus: (applicationId) => {
      return atom.value.statuses.get(applicationId);
    },
    isFavorited: (applicationId) => {
      return atom.value.favorited.has(applicationId);
    },

    setUser: (user) => {
      atom.update((value) => ({ ...value, user }));
    },
    setAppsLoaded: (value) => {
      atom.update((store) => ({ ...store, appsLoaded: value }));
    },
    setProblem: (problem) => {
      atom.update((store) => ({ ...store, problem }));
    },
    setLastUpdated: (lastUpdated) => {
      atom.update((store) => ({ ...store, lastUpdated }));
    },
  }),
);

/**
 * Subscribes only to the selected slice of the store. The listener fires once
 * with the initial value and then only when the projected value changes by
 * reference equality. Returns a `Disposable` so it can be pushed straight onto
 * `context.subscriptions` or a manager's bag without an extra wrapper.
 */
export function selectAndSubscribe<T>(
  selector: (state: ExtensionStore) => T,
  listener: (value: T) => void,
): Disposable {
  let previous = selector($extensionStore.value);
  listener(previous);
  const unsubscribe = $extensionStore.subscribe((state) => {
    const next = selector(state);
    if (next === previous) return;
    previous = next;
    listener(next);
  });
  return { dispose: unsubscribe };
}
