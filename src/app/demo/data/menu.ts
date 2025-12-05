import { Navigation } from 'src/app/@theme/types/navigation';

export const menus: Navigation[] = [
  {
    id: 'navigation',
    title: '',
    type: 'group',
    icon: 'ti ti-menu-2',
    children: [
      {
        id: 'Dashboard',
        title: 'Dashboard',
        type: 'item',
        classes: 'nav-item',
        url: '/dashboard',
        icon: 'ti ti-home'
      },
      {
        id: 'Sobre',
        title: 'Sobre',
        type: 'item',
        classes: 'nav-item',
        url: '/sobre',
        icon: 'ti ti-info-square-rounded'
      }
    ]
  },
  {
    id: 'adminOnly',
    title: 'Administração',
    type: 'group',
    icon: 'ti ti-shield',
    adminOnly: true,
    children: [
      {
        id: 'Mensagens',
        title: 'Mensagens',
        type: 'item',
        classes: 'nav-item',
        url: '/mensagens',
        icon: 'ti ti-mail'
      }
    ]
  },
  {
    id: 'eleicoesDiretorias',
    title: 'Eleições de Diretorias',
    type: 'group',
    icon: 'ti ti-menu-2',
    children: [
      {
        id: 'Registrar Eleições',
        title: 'Registrar Eleições',
        type: 'item',
        classes: 'nav-item',
        url: '/eleicoes/registrar',
        icon: 'ti ti-file-plus'
      },
      {
        id: 'Gerenciar Eleicões',
        title: 'Gerenciar Eleicões',
        type: 'item',
        classes: 'nav-item',
        url: '/eleicoes/lista',
        icon: 'ti ti-adjustments-check'
      }
    ]
  },
  {
    id: 'eleicaoOficiais',
    title: 'Eleições de Oficiais',
    type: 'group',
    icon: 'ti ti-menu-2',
    children: [
      {
        id: 'Registrar Eleições de Oficiais',
        title: 'Registrar Eleições',
        type: 'item',
        classes: 'nav-item',
        url: '/eleicoes/oficiais/registrar',
        icon: 'ti ti-file-plus'
      },
      {
        id: 'Gerenciar Eleições de Oficiais',
        title: 'Gerenciar Eleições',
        type: 'item',
        classes: 'nav-item',
        url: '/eleicoes/oficiais/gerenciar',
        icon: 'ti ti-adjustments-check'
      }
    ]
  },
  {
    id: 'inscricoes',
    title: 'Inscrições',
    type: 'group',
    icon: 'ti ti-menu-2',
    children: [
      {
        id: 'Gerenciar Inscrições',
        title: 'Gerenciar Inscrições',
        type: 'item',
        classes: 'nav-item',
        url: '/inscricoes/lista',
        icon: 'ti ti-list-details'
      }
    ]
  }
];
