import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LogOut,
  Moon,
  Settings,
  Sun,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { HireschemaLogo } from './brand/HireschemaLogo';
import { cn } from '../lib/utils';
import { isAppAdmin } from '../lib/isAppAdmin';
import { getAppNavGroups } from '../lib/appNav';
import { WhatsAppSupportLink } from './support/WhatsAppSupportLink';

function initials(name?: string, email?: string) {
  const source = name || email || 'User';
  return source
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U';
}

import { useDashboardJobsContext } from '../contexts/DashboardJobsContext';

export function Sidebar() {
  const { profile, user, logout, isImpersonating, stopImpersonating } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { filteredAndSortedJobs, stats } = useDashboardJobsContext();
  const location = useLocation();

  const dashboardCount = filteredAndSortedJobs.length > 0 ? String(filteredAndSortedJobs.length) : undefined;
  const savedCount = (stats as any)?.total > 0 ? String((stats as any).total) : undefined;

  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    user
      .getIdTokenResult()
      .then((result) => setIsAdmin(isAppAdmin(user.email, result.claims as { superAdmin?: boolean })))
      .catch(() => setIsAdmin(isAppAdmin(user.email)));
  }, [user]);

  const navGroups = getAppNavGroups(dashboardCount, savedCount, isAdmin);


  const plan = profile?.plan?.toLowerCase() === 'pro' ? 'Pro' : 'Free';
  const nextHour = String(profile?.preferredDeliveryHour ?? 8).padStart(2, '0');

  return (
    <aside className="hs-sidebar">
      <Link to="/dashboard" className="hs-sidebar-logo">
        <HireschemaLogo height={22} />
        <span className="hs-badge">{plan}</span>
      </Link>

      <div className="hs-scout-card">
        <div className="hs-scout-row">
          <span className="hs-label">Scout</span>
          <span className="hs-dot" />
        </div>
        <div className="font-mono text-[11px] font-semibold text-[var(--hs-app-fg)]">
          Next run — {nextHour}:00
        </div>
        <div className="mt-1 text-[11px] text-[var(--hs-app-muted)]">
          Daily Apify scan · resume-matched
        </div>
      </div>

      <button
        type="button"
        onClick={toggleTheme}
        className="mx-2 mb-1 flex items-center justify-center rounded border border-[var(--hs-app-border)] px-3 py-2 text-[11px] text-[var(--hs-app-muted)] transition hover:bg-[var(--hs-app-bg)] hover:text-[var(--hs-app-fg)]"
      >
        {theme === 'dark' ? <Moon className="mr-2 h-3.5 w-3.5" /> : <Sun className="mr-2 h-3.5 w-3.5" />}
        <span className="font-mono text-[10px]">Toggle theme</span>
      </button>

      {isImpersonating && (
        <button
          type="button"
          onClick={() => {
            stopImpersonating();
            window.location.href = '/kingdomofkumar';
          }}
          className="mx-3 mb-2 rounded-md border border-[var(--hs-app-warn)] bg-[var(--hs-app-warn-bg)] px-3 py-2 text-left text-[11px] text-[var(--hs-app-fg)]"
        >
          Stop impersonating {profile?.email}
        </button>
      )}

      <nav className="hs-nav">
        {navGroups.map((group) => (
          <React.Fragment key={group.label}>
            <div className="hs-nav-section">{group.label}</div>
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
              return (
                <Link key={item.path} to={item.path} className={cn('hs-nav-item', active && 'active')}>
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.6} />
                  <span>{item.name}</span>
                  {item.count ? <span className="hs-nav-count">{item.count}</span> : null}
                </Link>
              );
            })}
          </React.Fragment>
        ))}
      </nav>

      <div className="hs-sidebar-footer">
        <div className="mb-3 flex items-center gap-3 rounded-md px-2 py-2 transition hover:bg-[var(--hs-app-bg)]">
          {profile?.photoURL ? (
            <img src={profile.photoURL} alt="" className="h-[30px] w-[30px] rounded border border-[var(--hs-app-border)] object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="flex h-[30px] w-[30px] items-center justify-center rounded border border-[var(--hs-app-border)] bg-[var(--hs-app-bg)] font-mono text-[11px] font-bold text-[var(--hs-app-muted)]">
              {initials(profile?.displayName, profile?.email)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-[var(--hs-app-fg)]">
              {profile?.displayName || profile?.email?.split('@')[0] || 'Account'}
            </div>
            <div className="truncate font-mono text-[10px] text-[var(--hs-app-muted)]">{plan} Plan</div>
          </div>
        </div>
        <WhatsAppSupportLink
          className="mb-2 w-full justify-center rounded border border-[#25D366]/30 bg-[#25D366]/10 px-3 py-2 text-[11px] font-medium text-[#128C7E] hover:bg-[#25D366]/15"
          showPhone={false}
        >
          WhatsApp support
        </WhatsAppSupportLink>
        <button type="button" className="hs-btn w-full justify-start" onClick={logout}>
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
