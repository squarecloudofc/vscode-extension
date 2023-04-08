import EventEmitter = require('events');
import { setTimeout } from 'timers/promises';
import * as vscode from 'vscode';
import { t } from 'vscode-ext-localisation';
import { ApplicationStatusData, FullUserData } from '../interfaces/api';
import apiService from '../services/api.service';
import { Application } from '../structures/application';

class CacheManager extends EventEmitter {
  public applications: Application[] = [];
  public user?: FullUserData;
  public paused: boolean = false;
  public status = new Map<string, ApplicationStatusData>();
  public tasks: Function[] = [];

  async refreshData(bypass?: boolean) {
    if (!bypass && this.paused) {
      this.throwPausedError();
      return;
    }

    await this.handleProgress(() =>
      this.pauseUntil(async () => {
        const data = await apiService.user();
        if (!data?.response || !apiService.hasAccess(data.response)) {
          return;
        }

        this.user = data.response.user;
        this.applications = data.response.applications.map(
          (appData) => new Application(appData)
        );
      })
    );

    this.emit('refreshData');
  }

  async refreshStatusAll() {
    for (const { id } of this.applications) {
      await this.refreshStatus(id);
      await setTimeout(300);
    }

    this.emit('refreshStatusAll');
  }

  async refreshStatus(appId: string, bypass?: boolean) {
    if (!bypass && this.paused) {
      this.throwPausedError();
      return;
    }

    const app = this.applications.find((app) => app.id === appId);
    if (!app) {
      return;
    }

    await this.handleProgress(() =>
      this.pauseUntil(async () => {
        const status = await app.status();
        if (status) {
          this.status.set(appId, status);
        }
      })
    );

    this.emit('refreshStatus', appId);
  }

  handleProgress<T, U extends Promise<T>>(fn: () => U) {
    return <U>vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: t('generic.refreshing'),
      },
      fn
    );
  }

  pauseUntil<T>(fn: () => Promise<T>): Promise<T> {
    this.pause();
    return fn().finally(() => this.pause(null));
  }

  throwPausedError() {
    return vscode.window.showErrorMessage(t('generic.wait'));
  }

  pause(value: boolean | undefined | null = true) {
    this.paused = Boolean(value);
  }
}

export default new CacheManager();
