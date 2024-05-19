import type {
	ApplicationStatus,
	BaseApplication,
	SimpleApplicationStatus,
} from "@squarecloud/api";
import { createStore } from "zustand/vanilla";

export interface ApplicationsStore {
	applications: Map<string, BaseApplication>;
	statuses: Map<string, SimpleApplicationStatus>;
	fullStatuses: Map<string, ApplicationStatus>;
	favorited: Set<string>;

	setApplications(applications: BaseApplication[]): void;
	setFullStatuses(fullStatuses: ApplicationStatus[]): void;
	addFullStatus(fullStatus: ApplicationStatus): void;
	setStatuses(statuses: SimpleApplicationStatus[]): void;
	toggleFavorite(applicationId: string): void;

	getFullStatus(applicationId: string): ApplicationStatus | undefined;
	getStatus(applicationId: string): SimpleApplicationStatus | undefined;
	isFavorited(applicationId: string): boolean;
}

const {
	getState: get,
	setState: set,
	subscribe,
} = createStore<ApplicationsStore>((set, get) => ({
	applications: new Map(),
	fullStatuses: new Map(),
	statuses: new Map(),
	favorited: new Set<string>(),

	setApplications: (applications) => {
		const map = new Map(applications.map((app) => [app.id, app]));

		set({ applications: map });
	},
	setFullStatuses: (fullStatuses) => {
		const map = new Map(
			fullStatuses.map((fullStatus) => [fullStatus.applicationId, fullStatus]),
		);

		set({ fullStatuses: map });
	},
	addFullStatus: (fullStatus) => {
		const map = get().fullStatuses.set(fullStatus.applicationId, fullStatus);

		set({ fullStatuses: map });
	},
	setStatuses: (statuses) => {
		const map = new Map(
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

	getFullStatus: (applicationId) => {
		return get().fullStatuses.get(applicationId);
	},
	getStatus: (applicationId) => {
		return get().statuses.get(applicationId);
	},
	isFavorited: (applicationId) => {
		return get().favorited.has(applicationId);
	},
}));

export const applicationsStore = { get, set, subscribe };
