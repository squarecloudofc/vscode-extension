import type { ApplicationStatus } from "@/structures/application/status";
import { type BaseApplication, Collection } from "@squarecloud/api";
import { atom } from "xoid";

export interface ExtensionStore {
	applications: Collection<string, BaseApplication>;
	statuses: Collection<string, ApplicationStatus>;
	favorited: Set<string>;
}

export interface ExtensionStoreActions {
	setApplications(applications: BaseApplication[]): void;
	setStatuses(statuses: ApplicationStatus[]): void;
	setStatus(status: ApplicationStatus): void;
	setFavorited(applicationsId: string[]): void;
	toggleFavorite(applicationId: string, value?: boolean): void;

	getStatus(applicationId: string): ApplicationStatus | undefined;
	isFavorited(applicationId: string): boolean;
}

export const $extensionStore = atom<ExtensionStore, ExtensionStoreActions>(
	{
		applications: new Collection(),
		statuses: new Collection(),
		favorited: new Set(),
	},
	(atom) => ({
		setApplications: (applications) => {
			const map = new Collection(applications.map((app) => [app.id, app]));

			atom.update((value) => ({ ...value, applications: map }));
		},
		setStatus: (status) => {
			const map = atom.value.statuses.set(status.applicationId, status);

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
			const favorited = atom.value.favorited;
			const isFavorited = favorited?.has(applicationId);
			const toFavorite = value !== undefined ? value : !isFavorited;

			favorited?.[toFavorite ? "add" : "delete"](applicationId);

			atom.update((value) => ({ ...value, favorited }));
		},

		getStatus: (applicationId) => {
			return atom.value.statuses.get(applicationId);
		},
		isFavorited: (applicationId) => {
			return atom.value.favorited.has(applicationId);
		},
	}),
);
