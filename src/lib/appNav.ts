import type { LucideIcon } from 'lucide-react';
import {
  Bookmark,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  MessageSquareText,
  Settings,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

export type AppNavItem = {
  name: string;
  path: string;
  icon: LucideIcon;
  count?: string;
  mobilePrimary?: boolean;
};

export type AppNavGroup = {
  label: string;
  items: AppNavItem[];
};

export function getAppNavGroups(
  dashboardCount?: string,
  savedCount?: string,
  isAdmin?: boolean
): AppNavGroup[] {
  const groups: AppNavGroup[] = [
    {
      label: 'Workspace',
      items: [
        {
          name: 'Jack',
          path: '/chat',
          icon: MessageSquareText,
          count: dashboardCount,
          mobilePrimary: true,
        },
        {
          name: "Today's matches",
          path: '/dashboard',
          icon: LayoutDashboard,
          mobilePrimary: true,
        },
      ],
    },
    {
      label: 'Library',
      items: [
        {
          name: 'Pipeline',
          path: '/jobs',
          icon: Bookmark,
          count: savedCount,
          mobilePrimary: true,
        },
        { name: 'Resume', path: '/resume', icon: FileText, mobilePrimary: true },
        { name: 'Cover Letters', path: '/cover-letters', icon: MessageSquareText },
        { name: 'Interview Prep', path: '/interview-prep', icon: ClipboardCheck },
      ],
    },
    {
      label: 'System',
      items: [{ name: 'Settings', path: '/settings', icon: Settings, mobilePrimary: true }],
    },
  ];

  if (isAdmin) {
    groups.push({
      label: 'Admin',
      items: [{ name: 'SuperAdmin', path: '/superadmin', icon: ShieldCheck }],
    });
  }

  return groups;
}

export const MOBILE_SCOUT_ITEM: AppNavItem = {
  name: 'Search jobs',
  path: '/chat',
  icon: Sparkles,
  mobilePrimary: true,
};
