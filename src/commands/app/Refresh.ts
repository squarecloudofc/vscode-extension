import { ApplicationItem } from '../../providers';
import { Command } from '../../structures/Command';

export default new Command('refreshEntry', (ctx, { app }: ApplicationItem) => {
  if (ctx.cache.blocked) {
    ctx.cache.throwBlockError();
    return;
  }

  ctx.cache.refreshStatus(app.id);
});
