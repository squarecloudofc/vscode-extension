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

    await this.handleProgress(async () =>
      this.blockUntil(async () => this.status.set(appId, await app.getStatus()))
    );

    this.emit('refreshStatus', appId);
  }

  async refresh(bypass?: boolean) {
    if (!bypass && this.blocked) {
      this.handleBlock();
      return;
    }

    await this.handleProgress(async () =>
      this.blockUntil(async () => {
        this.user = await this.fetchUser().catch((err) => {
          console.error(err);
          return undefined;
        });

        this.applications = await this.fetchApplications().catch((err) => {
          console.error(err);
          return [];
        });
      })
    );

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

  handleProgress<T>(fn: () => Promise<T>): Promise<T> {
    return <Promise<T>>vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: t('generic.refreshing'),
      },
      async (progress) => {
        const response = await fn();

        progress.report({ increment: 100 });

        return response;
      }
    );
  }

  block(value: boolean) {
    this.blocked = value;
    return this;
  }

  handleBlock() {
    return vscode.window.showErrorMessage(t('generic.wait'));
  }

  async blockUntil<T>(fn: () => Promise<T>): Promise<T> {
    this.block(true);
    return await fn().finally(() => this.block(false));
  }
}

type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;
