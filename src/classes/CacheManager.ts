import SquareCloudAPI, { Application } from '@squarecloud/api';
import { SquareCloud } from './SquareCloud';
import { EventEmitter } from 'events';

export default class CacheManager extends EventEmitter {
  public applications: Application[] = [];
  public api?: SquareCloudAPI;

  constructor(public context: SquareCloud, public interval?: number) {
    super();

    this.setApi();
    this.refresh();

    if (interval) {
      setInterval(() => this.refresh(), interval);
    }
  }

  setApi() {
    if (this.context.apiKey) {
      this.api = new SquareCloudAPI(this.context.apiKey);
    }
  }

  async refresh() {
    this.applications = await this.fetchApplications().catch((err) => {
      console.error(err);
      return [];
    });
    
    this.emit('refresh');
  }

  async fetchApplications() {
    const user = await this.api?.getUser?.();

    if (!user?.applications?.size) {
      return [];
    }

    return user.applications.toJSON();
  }
}
