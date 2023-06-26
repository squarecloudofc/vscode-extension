import cacheManager from '../../managers/cache.manager';
import { ApplicationCommand } from '../../structures/application.command';

export default new ApplicationCommand('refreshEntry', ({ application }) => {
  if (cacheManager.paused) {
    cacheManager.throwPausedError();
    return;
  }

  cacheManager.refreshStatus(application.id);
});
