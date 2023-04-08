import cacheManager from '../../managers/cache.manager';
import { ApplicationCommand } from '../../structures/application.command';

new ApplicationCommand('refreshEntry', (_ctx, { application }) => {
  if (cacheManager.paused) {
    cacheManager.throwPausedError();
    return;
  }

  cacheManager.refreshStatus(application.id);
});
