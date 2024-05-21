import type { ApplicationStatus } from "@/structures/application/status";
import { type BaseApplication, Collection } from "@squarecloud/api";
import { createStore } from "zustand/vanilla";

export interface ApplicationsStore {
	applications: Collection<string, BaseApplication>;
	statuses: Collection<string, ApplicationStatus>;
	favorited: Set<string>;

	setApplications(applications: BaseApplication[]): void;
	setStatuses(statuses: ApplicationStatus[]): void;
	setStatus(status: ApplicationStatus): void;
	toggleFavorite(applicationId: string): void;

	getStatus(applicationId: string): ApplicationStatus | undefined;
	isFavorited(applicationId: string): boolean;
}

const {
	getState: get,
	setState: set,
	subscribe,
} = createStore<ApplicationsStore>((set, get) => ({
	applications: new Collection(),
	statuses: new Collection(),
	favorited: new Set<string>(),

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
	toggleFavorite: (applicationId) => {
		const favorited = get().favorited;
		const isFavorited = favorited.has(applicationId);

		if (isFavorited) {
			favorited.delete(applicationId);
		} else {
			favorited.add(applicationId);
		}

		set({ favorited });
	},

	getStatus: (applicationId) => {
		return get().statuses.get(applicationId);
	},
	isFavorited: (applicationId) => {
		return get().favorited.has(applicationId);
	},
}));

export const applicationsStore = { get, set, subscribe };
