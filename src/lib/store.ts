import type { Disposable } from "vscode";
import {
  type BaseApplication,
  Collection,
  type Database,
  type User,
  type Workspace,
} from "@squarecloud/api";
import { atom } from "xoid";

import type { ApplicationStatus } from "@/structures/application/status";

export interface ServiceStatus {
  status: string;
  message: string;
}

export interface ExtensionStore {
  applications: Collection<string, BaseApplication>;
  statuses: Collection<string, ApplicationStatus>;
  favorited: Set<string>;
  workspaces: Workspace[];
  databases: Collection<string, Database>;
  serviceStatus?: ServiceStatus;
  user?: User;
  appsLoaded: boolean;
}

export interface ExtensionStoreActions {
  setApplications(applications: BaseApplication[]): void;
  setStatuses(statuses: ApplicationStatus[]): void;
  setStatus(status: ApplicationStatus): void;
  setFavorited(applicationsId: string[]): void;
  toggleFavorite(applicationId: string, value?: boolean): void;

  setWorkspaces(workspaces: Workspace[]): void;
  setDatabases(databases: Database[]): void;
  setServiceStatus(status?: ServiceStatus): void;

  getStatus(applicationId: string): ApplicationStatus | undefined;
  isFavorited(applicationId: string): boolean;

  setUser(user?: User): void;
  setAppsLoaded(value: boolean): void;
}

export const $extensionStore = atom<ExtensionStore, ExtensionStoreActions>(
  {
    applications: new Collection(),
    statuses: new Collection(),
    favorited: new Set(),
    workspaces: [],
    databases: new Collection(),
    serviceStatus: undefined,
    user: undefined,
    appsLoaded: false,
  },
  (atom) => ({
    setApplications: (applications) => {
      const map = new Collection(applications.map((app) => [app.id, app]));

      atom.update((value) => ({ ...value, applications: map }));
    },
    setStatus: (status) => {
      // Build a new Collection so the reference changes — `selectAndSubscribe`
      // compares slices with `===`, and mutating in place left the reference
      // stable, which meant tree views never refreshed on status updates.
      const map = new Collection(atom.value.statuses);
      map.set(status.applicationId, status);
      atom.update((value) => ({ ...value, statuses: map }));
    },
    setStatuses: (statuses) => {
      const map = new Collection(
        statuses.map((status) => [status.applicationId, status]),
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
      const map = new Collection(databases.map((db) => [db.id, db]));
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
