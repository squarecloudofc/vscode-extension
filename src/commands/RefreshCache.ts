import { Command } from '../structures/Command';

export default new Command('refreshCache', (ctx) => {
  ctx.cache.refresh();
});
