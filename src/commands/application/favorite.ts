import cacheManager from '../../managers/cache.manager';
import { ApplicationCommand } from '../../structures/application.command';

new ApplicationCommand('favoriteEntry', ({ application }) => {
  cacheManager.favorite(application);
});
