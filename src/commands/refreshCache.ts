import cacheManager from '../managers/cache.manager';
import { Command } from '../structures/command';

new Command('refreshCache', () => {
  if (cacheManager.paused) {
    cacheManager.throwPausedError();
    return;
  }

  cacheManager.refreshData();
});
