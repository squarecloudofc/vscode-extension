import { Command } from '../structures/Command';

export default new Command('refreshCache', (ctx) => {
  if (ctx.cache.blocked) {
    ctx.cache.throwBlockError();
    return;
  }

  ctx.cache.refresh();
});
