import SquareCloudAPI, { Application, FullUser } from '@squarecloud/api';
import { SquareCloud } from '../structures/SquareCloud';
import { t } from 'vscode-ext-localisation';
import { EventEmitter } from 'events';
import * as vscode from 'vscode';

export default class CacheManager extends EventEmitter {
  public applications: Application[] = [];
  public user?: FullUser;

  public blocked: boolean = false;

  public status = new Map<
    string,
    ThenArg<ReturnType<Application['getStatus']>>
  >();

  constructor(public context: SquareCloud) {
    super();
  }

  get api() {
    if (!this.context.apiKey) {
      return;
    }

    return new SquareCloudAPI(this.context.apiKey);
  }

  async refreshStatus(appId: string, bypass?: boolean) {
    if (!bypass && this.blocked) {
      vscode.window.showErrorMessage(t('generic.wait'));
      return;
    }

    const app = this.applications.find((app) => app.id === appId);

    if (!app) {
      return;
    }

    this.blocked = true;
    this.status.set(appId, await app.getStatus());
    this.blocked = false;

    console.log('refreshStatus');

    this.emit('refreshStatus', appId);
  }

  async refresh(bypass?: boolean) {
    if (!bypass && this.blocked) {
      vscode.window.showErrorMessage(t('generic.wait'));
      return;
    }

    this.blocked = true;

    this.user = await this.fetchUser().catch((err) => {
      console.error(err);
      return undefined;
    });

    this.applications = await this.fetchApplications().catch((err) => {
      console.error(err);
      return [];
    });

    this.blocked = false;

    console.log('refresh');

    this.emit('refresh');
  }

  async fetchApplications() {
    const { user } = this;

    if (!user?.applications?.size) {
      return [];
    }

    return user.applications.toJSON();
  }

  async fetchUser() {
    return await this.api?.getUser?.();
  }
}

type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;
