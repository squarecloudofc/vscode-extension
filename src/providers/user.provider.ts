import { t } from 'vscode-ext-localisation';
import cacheManager from '../managers/cache.manager';
import { GenericTreeItem } from '../items';
import BaseProvider from './base.provider';
import configManager from '../managers/config.manager';

export default class UserProvider extends BaseProvider<GenericTreeItem> {
  async getChildren(
    _element?: GenericTreeItem | undefined
  ): Promise<GenericTreeItem[]> {
    const { user } = cacheManager;

    if (!user) {
      if (!configManager.apiKey) {
        return [];
      }

      return [
        new GenericTreeItem(
          t('generic.loading'),
          'ripple',
          undefined,
          'loading'
        ),
      ];
    }

    const treeItemsData: [string, string, string][] = [
      ['Username', 'username', user.tag],
      ['E-mail', 'email', user.email],
      ['Id', 'id', user.id],
      [capitalize(user.plan.name), 'plan', user.plan.duration.formatted],
      ['RAM', 'ram', `${user.plan.memory.used}/${user.plan.memory.limit}MB`],
    ];

    return treeItemsData.map(
      (treeItemData) => new GenericTreeItem(...treeItemData)
    );
  }
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
