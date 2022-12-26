import SquareCloudAPI, { FullUser } from '@squarecloud/api';

export default class APIManager {
  constructor(public apiKey?: string) {}

  fetchApps(user?: FullUser) {
    return user ? user.applications.toJSON() : [];
  }

  fetchUser() {
    if (!this.api) {
      return;
    }

    return this.api.getUser().catch(() => undefined);
  }

  get api() {
    if (!this.apiKey) {
      return;
    }

    return new SquareCloudAPI(this.apiKey);
  }
}
