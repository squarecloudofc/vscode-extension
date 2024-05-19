import { Store } from "@/structures/store";
import type {
	ApplicationStatus,
	BaseApplication,
	SimpleApplicationStatus,
} from "@squarecloud/api";

export interface ApplicationsStore {
	applications: BaseApplication[];
	statuses: SimpleApplicationStatus[];
	fullStatuses: ApplicationStatus[];
	favorited: string[];

	setApplications(applications: BaseApplication[]): void;
	addFullStatus(fullStatus: ApplicationStatus): void;
	setStatuses(statuses: SimpleApplicationStatus[]): void;
	toggleFavorite(applicationId: string): void;

	getFullStatus(applicationId: string): ApplicationStatus | undefined;
	getStatus(applicationId: string): SimpleApplicationStatus | undefined;
	isFavorited(applicationId: string): boolean;
}

const applicationsStore = new Store<ApplicationsStore>(([set, get]) => ({
	applications: [],
	fullStatuses: [],
	statuses: [],
	favorited: [],

	setApplications: (applications) => {
		set({ applications });
	},
	addFullStatus: (fullStatus) => {
		const previous = get().fullStatuses.filter(
			(status) => status.applicationId !== fullStatus.applicationId,
		);
		set({ fullStatuses: [...previous, fullStatus] });
	},
	setStatuses: (statuses) => {
		set({ statuses });
	},
	toggleFavorite: (applicationId) => {
		set({
			favorited: get().favorited.includes(applicationId)
				? get().favorited.filter((id) => id !== applicationId)
				: [...get().favorited, applicationId],
		});
	},

	getFullStatus: (applicationId) => {
		return get().fullStatuses.find(
			(status) => status.applicationId === applicationId,
		);
	},
	getStatus: (applicationId) => {
		return get().statuses.find(
			(status) => status.applicationId === applicationId,
		);
	},
	isFavorited: (applicationId) => {
		return get().favorited.includes(applicationId);
	},
}));

export default applicationsStore;
