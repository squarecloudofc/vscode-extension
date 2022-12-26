import SquareCloudAPI, { Application, FullUser } from '@squarecloud/api';
import { SquareCloud } from '../structures/SquareCloud';
import { t } from 'vscode-ext-localisation';
import { EventEmitter } from 'events';
import vscode from 'vscode';
import APIManager from './APIManager';

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
    return new APIManager(this.context.apiKey);
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

    await this.handleProgress(async () =>
      this.blockUntil(async () => this.status.set(appId, await app.getStatus()))
    );

    this.emit('refreshStatus', appId);
  }

  async refresh(bypass?: boolean) {
    if (!bypass && this.blocked) {
      this.throwBlockError();
      return;
    }

    await this.handleProgress(async () =>
      this.blockUntil(async () => {
        this.user = await this.api.fetchUser();
        this.applications = this.api.fetchApps(this.user);
      })
    );

    this.emit('refresh');
  }

  handleProgress<T>(fn: () => Promise<T>): Promise<T> {
    return <Promise<T>>vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: t('generic.refreshing'),
      },
      () => fn()
    );
  }

  block(value: boolean) {
    this.blocked = value;
  }

  throwBlockError() {
    return vscode.window.showErrorMessage(t('generic.wait'));
  }

  async blockUntil<T>(fn: () => Promise<T>): Promise<T> {
    this.block(true);
    return await fn().finally(() => this.block(false));
  }
}

type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;
