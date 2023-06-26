import { t } from 'vscode-ext-localisation';
import { ApplicationTreeItem, GenericTreeItem, SquareTreeItem } from '../items';
import cacheManager from '../managers/cache.manager';
import configManager from '../managers/config.manager';
import BaseProvider from './base.provider';
import prettyMilliseconds = require('pretty-ms');

export default class FavoritedProvider extends BaseProvider<SquareTreeItem> {
  async getChildren(
    element?: SquareTreeItem | undefined,
  ): Promise<SquareTreeItem[]> {
    const { contextValue } = element || {};

    if (
      ['square-bot', 'square-site', 'square-favorite'].includes(
        contextValue!,
      ) &&
      element instanceof ApplicationTreeItem
    ) {
      const status = cacheManager.status.get(element.application.id);

      if (!status) {
        return [];
      }

      const treeItemsData: [string, string, string][] = [
        [
          'Uptime',
          'uptime',
          status.uptime
            ? prettyMilliseconds(Date.now() - status.uptime, { compact: true })
            : 'Offline',
        ],
        ['CPU', 'cpu', status.cpu],
        ['RAM', 'ram', `${status.ram}/${element.application.ram}MB`],
        [t('generic.network'), 'network', status.network.now],
        [t('generic.storage'), 'storage', status.storage],
      ];

      return treeItemsData.map(
        (treeItemData) => new GenericTreeItem(...treeItemData),
      );
    }

    const { applications } = cacheManager;

    if (!applications.length) {
      if (!configManager.apiKey) {
        return [];
      }

      return [
        new GenericTreeItem(
          t('generic.loading'),
          'ripple',
          undefined,
          'loading',
        ),
      ];
    }

    const filteredApplications = applications.filter((app) =>
      cacheManager.isFavorited(app),
    );

    return filteredApplications.map((app) => new ApplicationTreeItem(app));
  }
}
