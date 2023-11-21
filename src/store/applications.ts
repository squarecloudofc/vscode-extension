import { Application, SimpleApplicationStatus } from "@squarecloud/api";
import { Store } from ".";

export interface ApplicationsState {
  statuses: SimpleApplicationStatus[];
  applications: Application[];
  favorited: string[];

  setApplications(applications: Application[]): void;
  setStatuses(statuses: SimpleApplicationStatus[]): void;
  toggleFavorite(applicationId: string): void;

  getStatus(applicationId: string): SimpleApplicationStatus | undefined;
  isFavorited(applicationId: string): boolean;
}

export default new Store<ApplicationsState>(({ get, set }) => ({
  applications: [],
  statuses: [],
  favorited: [],

  setApplications: (applications: Application[]) => set({ applications }),
  setStatuses: (statuses: SimpleApplicationStatus[]) => set({ statuses }),
  toggleFavorite: (applicationId: string) =>
    set({
      favorited: get().favorited.includes(applicationId)
        ? get().favorited.filter((id) => id !== applicationId)
        : [...get().favorited, applicationId],
    }),

  getStatus: (applicationId: string) => get().statuses.find((status) => status.applicationId === applicationId),
  isFavorited: (applicationId: string) => get().favorited.includes(applicationId),
}));
