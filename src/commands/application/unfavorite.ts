import cacheManager from '../../managers/cache.manager';
import { ApplicationCommand } from '../../structures/application.command';

new ApplicationCommand('unfavoriteEntry', ({ application }) => {
  cacheManager.unfavorite(application);
});
