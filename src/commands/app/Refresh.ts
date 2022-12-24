import { Command } from '../../structures/Command';
import { ApplicationItem } from '../../providers';

export default new Command('refreshEntry', (ctx, { app }: ApplicationItem) => {
  ctx.cache.refreshStatus(app.id);
});
