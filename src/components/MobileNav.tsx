import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MoreHorizontal, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardJobsContext } from '../contexts/DashboardJobsContext';
import { isAppAdmin } from '../lib/isAppAdmin';
import { getAppNavGroups, MOBILE_SCOUT_ITEM } from '../lib/appNav';
import { WhatsAppSupportLink } from './support/WhatsAppSupportLink';
import { cn } from '../lib/utils';

function isActive(path: string, pathname: string, search: string) {
  if (path.includes('?')) {
    const [pathOnly, query] = path.split('?');
    return pathname === pathOnly && search.includes(query);
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function MobileNav() {
  const { user } = useAuth();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [admin, setAdmin] = useState(false);
  const { filteredAndSortedJobs, stats } = useDashboardJobsContext();

  useEffect(() => {
    if (!user) {
      setAdmin(false);
      return;
    }
    user
      .getIdTokenResult()
      .then((result) => setAdmin(isAppAdmin(user.email, result.claims as { superAdmin?: boolean })))
      .catch(() => setAdmin(isAppAdmin(user.email)));
  }, [user]);

  const dashboardCount =
    filteredAndSortedJobs.length > 0 ? String(filteredAndSortedJobs.length) : undefined;
  const savedCount = (stats as any)?.total > 0 ? String((stats as any).total) : undefined;
  const groups = getAppNavGroups(dashboardCount, savedCount, admin);

  const primaryItems = groups
    .flatMap((group) => group.items)
    .filter((item) => item.mobilePrimary);
  const secondaryItems = [
    ...groups.flatMap((group) => group.items).filter((item) => !item.mobilePrimary),
    MOBILE_SCOUT_ITEM,
  ];

  const barItems = [
    primaryItems.find((item) => item.path === '/dashboard'),
    primaryItems.find((item) => item.path === '/jobs'),
    primaryItems.find((item) => item.path === '/resume'),
    primaryItems.find((item) => item.path === '/settings'),
  ].filter(Boolean) as typeof primaryItems;

  return (
    <>
      {moreOpen ? (
        <div
          className="hs-mobile-more-backdrop"
          role="presentation"
          onClick={() => setMoreOpen(false)}
        />
      ) : null}

      {moreOpen ? (
        <div className="hs-mobile-more-menu" role="menu">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--hs-app-muted)]">
              More
            </span>
            <button
              type="button"
              aria-label="Close menu"
              className="rounded-full p-1 text-[var(--hs-app-muted)]"
              onClick={() => setMoreOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {secondaryItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path, location.pathname, location.search);
            return (
              <Link
                key={item.path}
                to={item.path}
                role="menuitem"
                className={cn('hs-mobile-more-link', active && 'active')}
                onClick={() => setMoreOpen(false)}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.6} />
                <span>{item.name}</span>
              </Link>
            );
          })}
          <WhatsAppSupportLink
            className="hs-mobile-more-link text-[#128C7E]"
            onClick={() => setMoreOpen(false)}
          />
        </div>
      ) : null}

      <nav className="hs-mobile-nav" aria-label="Mobile navigation">
        {barItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path, location.pathname, location.search);
          const label =
            item.path === '/dashboard'
              ? 'Matches'
              : item.path === '/jobs'
              ? 'Pipeline'
              : item.name;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn('hs-mobile-nav-item', active && 'active')}
            >
              <Icon className="h-5 w-5" strokeWidth={1.6} />
              <span>{label}</span>
              {item.count ? <span className="hs-mobile-nav-badge">{item.count}</span> : null}
            </Link>
          );
        })}
        <button
          type="button"
          className={cn('hs-mobile-nav-item', moreOpen && 'active')}
          aria-expanded={moreOpen}
          aria-haspopup="menu"
          onClick={() => setMoreOpen((open) => !open)}
        >
          <MoreHorizontal className="h-5 w-5" strokeWidth={1.6} />
          <span>More</span>
        </button>
      </nav>
    </>
  );
}
