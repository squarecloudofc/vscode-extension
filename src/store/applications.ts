import { BaseApplication, SimpleApplicationStatus } from "@squarecloud/api";
import { Store } from ".";

export interface ApplicationsStore {
  statuses: SimpleApplicationStatus[];
  applications: BaseApplication[];
  favorited: string[];

  setApplications(applications: BaseApplication[]): void;
  setStatuses(statuses: SimpleApplicationStatus[]): void;
  toggleFavorite(applicationId: string): void;

  getStatus(applicationId: string): SimpleApplicationStatus | undefined;
  isFavorited(applicationId: string): boolean;
}

const applicationsStore = new Store<ApplicationsStore>((store) => ({
  applications: [],
  statuses: [],
  favorited: [],

  setApplications: (applications) => store.set({ applications }),
  setStatuses: (statuses) => store.set({ statuses }),
  toggleFavorite: (applicationId) =>
    store.set({
      favorited: store.get().favorited.includes(applicationId)
        ? store.get().favorited.filter((id) => id !== applicationId)
        : [...store.get().favorited, applicationId],
    }),

  getStatus: (applicationId) => store.get().statuses.find((status) => status.applicationId === applicationId),
  isFavorited: (applicationId) => store.get().favorited.includes(applicationId),
}));

export default applicationsStore;
