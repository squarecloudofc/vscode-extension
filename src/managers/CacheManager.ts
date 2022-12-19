import SquareCloudAPI, { Application, FullUser } from '@squarecloud/api';
import { SquareCloud } from '../structures/SquareCloud';
import { EventEmitter } from 'events';

export default class CacheManager extends EventEmitter {
  public applications: Application[] = [];
  public user?: FullUser;

  public api?: SquareCloudAPI;

  constructor(public context: SquareCloud, public interval?: number) {
    super();

    this.setApi();

    if (interval) {
      setInterval(() => this.refreshAll(), interval);
    }
  }

  setApi() {
    if (this.context.apiKey) {
      this.api = new SquareCloudAPI(this.context.apiKey);
    }
  }

  async refreshAll() {
    this.refreshUser();
    this.refreshApps();

    this.emit('refresh');
  }

  async refreshApps() {
    this.applications = await this.fetchApplications().catch((err) => {
      console.error(err);
      return [];
    });

    this.emit('refreshApps');
  }

  async refreshUser() {
    this.user = await this.fetchUser().catch((err) => {
      console.error(err);
      return undefined;
    });

    this.emit('refreshUser');
  }

  async fetchApplications() {
    const user = await this.fetchUser();

    if (!user?.applications?.size) {
      return [];
    }

    return user.applications.toJSON();
  }

  async fetchUser() {
    return await this.api?.getUser?.();
  }
}
