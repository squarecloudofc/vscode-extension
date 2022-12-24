import { BaseProvider, GenericTreeItem } from './BaseProvider';
import CacheManager from '../managers/CacheManager';
import { t } from 'vscode-ext-localisation';

export class UserProvider extends BaseProvider<GenericTreeItem> {
  constructor(private cache: CacheManager) {
    super();

    cache.on('refresh', () => {
      this.refresh();
    });
  }

  async getChildren(element?: GenericTreeItem): Promise<GenericTreeItem[]> {
    const { user } = this.cache;

    if (!user) {
      return [
        new GenericTreeItem(
          t('generic.loading'),
          'loading',
          undefined,
          'ripple'
        ),
      ];
    }

    return [
      new GenericTreeItem('Username', 'username', user.tag),
      new GenericTreeItem('E-mail', 'email', user.email),
      new GenericTreeItem('Id', 'id', user.id),
      new GenericTreeItem(
        capitalize(user.plan.name),
        'plan',
        user.plan.duration.formatted
      ),
    ];
  }
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}