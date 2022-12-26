import { Command } from '../../structures/Command';
import { ApplicationItem } from '../../providers';

export default new Command('refreshEntry', (ctx, { app }: ApplicationItem) => {
  if (ctx.cache.blocked) {
    ctx.cache.throwBlockError();
    return;
  }

  ctx.cache.refreshStatus(app.id);
});
