import { ApplicationItem } from '../../providers';
import { Command } from '../../structures/Command';

export default new Command('refreshEntry', (ctx, element: ApplicationItem) => {
  if (ctx.cache.blocked) {
    ctx.cache.throwBlockError();
    return;
  }

  ctx.cache.refreshStatus(element.app?.id);
});
