import type { NavGroup } from '@pixa/ui/types';

export const navGroups: NavGroup[] = [
  {
    label: 'Main',
    items: [
      {
        title: 'Dashboard',
        url: '/dashboard',
        icon: 'dashboard',
        isActive: false,
        items: []
      },
      {
        title: 'Orders',
        url: '/dashboard/orders',
        icon: 'post',
        isActive: false,
        items: []
      },
      {
        title: 'Products',
        url: '/dashboard/products',
        icon: 'product',
        isActive: false,
        items: []
      },
      {
        title: 'Customers',
        url: '/dashboard/customers',
        icon: 'teams',
        isActive: false,
        items: []
      }
    ]
  },
  {
    label: 'Settings',
    items: [
      {
        title: 'Settings',
        url: '/dashboard/settings',
        icon: 'settings',
        isActive: false,
        items: []
      }
    ]
  }
];
