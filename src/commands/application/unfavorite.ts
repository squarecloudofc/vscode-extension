import cacheManager from "../../managers/cache.manager";
import { ApplicationCommand } from "../../structures/application.command";

export default new ApplicationCommand("unfavoriteEntry", ({ application }) => {
  cacheManager.unfavorite(application);
});
