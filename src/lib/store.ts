import type { ApplicationStatus } from "@/structures/application/status";
import { type BaseApplication, Collection } from "@squarecloud/api";
import { createStore } from "zustand/vanilla";

export interface ExtensionStore {
	applications: Collection<string, BaseApplication>;
	statuses: Collection<string, ApplicationStatus>;
	favorited: Set<string>;

	setApplications(applications: BaseApplication[]): void;
	setStatuses(statuses: ApplicationStatus[]): void;
	setStatus(status: ApplicationStatus): void;
	setFavorited(applicationsId: string[]): void;
	toggleFavorite(applicationId: string, value?: boolean): void;

	getStatus(applicationId: string): ApplicationStatus | undefined;
	isFavorited(applicationId: string): boolean;
}

export const createExtensionStore = () =>
	createStore<ExtensionStore>((set, get) => ({
		applications: new Collection(),
		statuses: new Collection(),
		favorited: new Set(),

		setApplications: (applications) => {
			const map = new Collection(applications.map((app) => [app.id, app]));

			set({ applications: map });
		},
		setStatus: (status) => {
			const map = get().statuses.set(status.applicationId, status);

			set({ statuses: map });
		},
		setStatuses: (statuses) => {
			const map = new Collection(
				statuses.map((status) => [status.applicationId, status]),
			);

			set({ statuses: map });
		},

		setFavorited: (applicationsId) => {
			set({ favorited: new Set(applicationsId) });
		},
		toggleFavorite: (applicationId, value) => {
			const favorited = get().favorited;
			const isFavorited = favorited?.has(applicationId);
			const toFavorite = value !== undefined ? value : !isFavorited;

			favorited?.[toFavorite ? "add" : "delete"](applicationId);

			set({ favorited });
		},

		getStatus: (applicationId) => {
			return get().statuses.get(applicationId);
		},
		isFavorited: (applicationId) => {
			return get().favorited.has(applicationId);
		},
	}));
