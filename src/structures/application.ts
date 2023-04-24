import { ResponseCodes, Routes } from '../helpers/constants.helper';
import {
  ApplicationBackupData,
  ApplicationData,
  ApplicationLogsData,
  ApplicationStatusData,
  CommonSuccess,
} from '../interfaces/api';
import apiService from '../services/api.service';
import FormData = require('form-data');

export class Application {
  private readonly baseAppUrl = 'https://squarecloud.app/dashboard/app/';

  id: string;
  tag: string;
  url: string;
  avatar: string;
  cluster: string;
  ram: number;
  type: 'free' | 'paid';
  lang: string;
  isWebsite: boolean;

  constructor(data: ApplicationData) {
    const { avatar, cluster, id, isWebsite, lang, ram, tag, type } = data;

    this.id = id;
    this.tag = tag;
    this.url = this.baseAppUrl + id;
    this.avatar = avatar;
    this.cluster = cluster;
    this.ram = ram;
    this.type = type;
    this.lang = lang;
    this.isWebsite = isWebsite;
  }

  async status(): Promise<ApplicationStatusData | undefined> {
    const data = await apiService.application(Routes.Status, this.id);

    return data?.response;
  }

  async logs(full?: boolean): Promise<ApplicationLogsData | undefined> {
    const data = await apiService.application(
      `${full ? 'full-' : ''}logs`,
      this.id
    );

    return data?.response;
  }

  async backup(): Promise<ApplicationBackupData | undefined> {
    const data = await apiService.application(Routes.Backup, this.id);

    return data?.response;
  }

  async delete(): Promise<CommonSuccess> {
    const data = await apiService.application(Routes.Delete, this.id, {
      method: 'DELETE',
    });

    return { success: data?.code === ResponseCodes.AppDeleted };
  }

  async commit(file: Buffer, filename: string, restart: boolean = true) {
    const formData = new FormData();
    formData.append('file', file, { filename });

    const data = await apiService.application(
      Routes.Commit,
      this.id + `?restart=${restart}`,
      formData
    );

    return { success: data?.code === ResponseCodes.Success };
  }

  async start() {
    const data = await apiService.application(Routes.Start, this.id, true);

    return { success: data?.code === ResponseCodes.AppStarted };
  }

  async stop() {
    const data = await apiService.application(Routes.Stop, this.id, true);

    return { success: data?.code === ResponseCodes.AppStopped };
  }

  async restart() {
    const data = await apiService.application(Routes.Restart, this.id, true);

    return { success: data?.code === ResponseCodes.AppRestarted };
  }
}
