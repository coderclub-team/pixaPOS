import { create } from "zustand";
// import { persist } from 'zustand/middleware';
import type { NotificationStatus, NotificationAction } from "@pixa/ui/base-ui/notification-card";

export type Notification = {
  id: string;
  title: string;
  body: string;
  status: NotificationStatus;
  createdAt: string;
  actions?: NotificationAction[];
};

type NotificationState = {
  notifications: Notification[];
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  addNotification: (notification: Omit<Notification, "status">) => void;
  unreadCount: () => number;
};

const mockNotifications: Notification[] = [
  {
    id: "1",
    title: "New team member joined",
    body: "Sarah Connor has joined the Engineering workspace.",
    status: "unread",
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    actions: [
      {
        id: "view",
        label: "View workspace",
        type: "redirect",
        style: "primary",
      },
    ],
  },
  {
    id: "2",
    title: "New menu item added",
    body: 'A new item "Margherita Pizza" has been added to the menu.',
    status: "unread",
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    actions: [
      {
        id: "view-product",
        label: "View menu",
        type: "redirect",
        style: "primary",
      },
    ],
  },
  {
    id: "3",
    title: "Billing cycle updated",
    body: "Your Pro plan has been renewed. Next invoice on April 24, 2026.",
    status: "unread",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    actions: [
      {
        id: "billing",
        label: "View billing",
        type: "redirect",
        style: "primary",
      },
    ],
  },
  {
    id: "4",
    title: "KOT fired for Table T4",
    body: "2× Margherita Pizza sent to the kitchen as KOT #12.",
    status: "read",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    actions: [
      {
        id: "view-orders",
        label: "View orders",
        type: "redirect",
        style: "primary",
      },
    ],
  },
  {
    id: "5",
    title: "Low stock alert",
    body: "Mozzarella is below par level. Raise a purchase order before the dinner rush.",
    status: "read",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    actions: [
      {
        id: "view-stock",
        label: "View stock",
        type: "redirect",
        style: "primary",
      },
    ],
  },
];

export const useNotificationStore = create<NotificationState>()(
  // To enable persistence across refreshes, uncomment the persist wrapper below:
  // persist(
  (set, get) => ({
    notifications: mockNotifications,

    markAsRead: (id) =>
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, status: "read" as const } : n,
        ),
      })),

    markAllAsRead: () =>
      set((state) => ({
        notifications: state.notifications.map((n) => ({
          ...n,
          status: "read" as const,
        })),
      })),

    removeNotification: (id) =>
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      })),

    addNotification: (notification) =>
      set((state) => ({
        notifications: [{ ...notification, status: "unread" as const }, ...state.notifications],
      })),

    unreadCount: () => get().notifications.filter((n) => n.status === "unread").length,
  }),
  //   ,
  //   { name: 'notifications' }
  // )
);
