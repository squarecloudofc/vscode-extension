import { Application, SimpleApplicationStatus } from "@squarecloud/api";
import { Store } from ".";

export interface ApplicationsStore {
  statuses: SimpleApplicationStatus[];
  applications: Application[];
  favorited: string[];

  setApplications(applications: Application[]): void;
  setStatuses(statuses: SimpleApplicationStatus[]): void;
  toggleFavorite(applicationId: string): void;

  getStatus(applicationId: string): SimpleApplicationStatus | undefined;
  isFavorited(applicationId: string): boolean;
}

export default new Store<ApplicationsStore>(({ get, set }) => ({
  applications: [],
  statuses: [],
  favorited: [],

  setApplications: (applications) => set({ applications }),
  setStatuses: (statuses) => set({ statuses }),
  toggleFavorite: (applicationId) =>
    set({
      favorited: get().favorited.includes(applicationId)
        ? get().favorited.filter((id) => id !== applicationId)
        : [...get().favorited, applicationId],
    }),

  getStatus: (applicationId) => get().statuses.find((status) => status.applicationId === applicationId),
  isFavorited: (applicationId) => get().favorited.includes(applicationId),
}));
