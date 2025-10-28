import { Navigation } from 'src/app/@theme/types/navigation';

export const menus: Navigation[] = [
  {
    id: 'navigation',
    title: 'Navigation',
    type: 'group',
    icon: 'icon-navigation',
    children: [
      {
        id: 'Dashboard',
        title: 'Dashboard',
        type: 'item',
        classes: 'nav-item',
        url: '/dashboard',
        icon: '#custom-status-up'
      },
        {
        id: 'Registrar Eleições',
        title: 'Registrar Eleições',
        type: 'item',
        classes: 'nav-item',
        url: '/eleicoes/registrar',
        icon: '#custom-status-up'
      },
        {
        id: 'Gerenciar Eleicões',
        title: 'Gerenciar Eleicões',
        type: 'item',
        classes: 'nav-item',
        url: '/eleicoes/lista',
        icon: '#custom-status-up'
      }
    ]
  },
];
