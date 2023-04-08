export interface ApiResponse<T = any> {
  status: 'success' | 'error';
  response: T;
  code?: string;
}

export type UserResponseData =
  | {
      user: FullUserData;
      applications: ApplicationData[];
    }
  | {
      user: RestrictedUser;
      applications: never[];
    };

export interface BaseUserData {
  id: string;
  tag: string;
  locale: string;
  plan: UserPlanData;
  blocklist: boolean;
}

export interface FullUserData extends BaseUserData {
  email: string;
}

export interface RestrictedUser extends BaseUserData {
  email: null;
}

export interface UserPlanData {
  name: string;
  memory: { limit: number; available: number; used: number };
  duration: { formatted: string; raw: number };
}

export interface UploadedApplicatioData {
  id: string;
  tag: string;
  ram: number;
}

export interface ApplicationData {
  id: string;
  tag: string;
  ram: number;
  lang: string;
  type: 'free' | 'paid';
  cluster: string;
  isWebsite: boolean;
  avatar: string;
}

export type ApplicationStatus =
  | 'exited'
  | 'created'
  | 'starting'
  | 'restarting'
  | 'deleting'
  | 'running';

export interface ApplicationStatusData {
  network: {
    total: string;
    now: string;
  };
  storage: string;
  cpu: string;
  ram: string;
  status: ApplicationStatus;
  running: boolean;
  requests: number;
  uptime?: number;
  time?: number;
}

export interface ApplicationLogsData {
  logs: string;
}

export interface ApplicationBackupData {
  downloadURL: string;
}

export interface CommonSuccess<T = any> {
  success: boolean;
  data?: T;
}