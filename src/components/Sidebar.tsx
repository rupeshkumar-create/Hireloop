import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Briefcase, LayoutDashboard, Settings, LogOut } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';

export function Sidebar() {
  const { profile, logout, isImpersonating, stopImpersonating } = useAuth();
  const location = useLocation();

  const navItems = [
    { name: 'Daily Jobs', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Job Tracker', path: '/tracker', icon: Briefcase },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen w-72 flex-col border-r border-border bg-surface/50 backdrop-blur-sm">
      <div className="flex h-[4.5rem] items-center border-b border-border px-6">
        <div className="mr-3 rounded-2xl bg-foreground p-2 shadow-[0_0_0_1px_var(--color-near-black)]">
          <Briefcase className="h-4 w-4 text-surface" />
        </div>
        <div>
          <span className="font-display text-2xl leading-none tracking-tight text-foreground">Hireschema</span>
          <p className="mt-0.5 text-[11px] uppercase tracking-[0.16em] text-foreground-muted">Remote Job Agent</p>
        </div>
      </div>
      
      {isImpersonating && (
        <div className="m-4 rounded-2xl border border-[rgba(201,100,66,0.2)] bg-[rgba(201,100,66,0.12)] p-4 text-center text-xs font-medium text-foreground shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
          <p className="mb-2">Impersonating: {profile?.email}</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full bg-surface text-foreground"
            onClick={() => {
              stopImpersonating();
              window.location.href = '/kingdomofkumar';
            }}
          >
            Stop Impersonating
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-6">
        <nav className="space-y-2 px-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
            return (
              <Link
                key={item.name}
                to={item.path}
                className={cn(
                  "group flex items-center rounded-xl px-3 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-foreground text-background shadow-[0_0_0_1px_var(--color-near-black)] dark:bg-surface-hover dark:text-foreground"
                    : "text-foreground-muted hover:bg-surface-hover hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "mr-3 h-4 w-4 shrink-0",
                    isActive ? "text-background dark:text-foreground" : "text-foreground-muted group-hover:text-foreground"
                  )}
                />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-border p-4">
        <div className="mb-4 flex items-center rounded-2xl border border-border bg-background/70 px-3 py-3">
          {profile?.photoURL ? (
            <img src={profile.photoURL} alt="Profile" className="mr-3 h-10 w-10 rounded-full border border-border object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-border text-sm font-medium text-foreground-muted">
              {profile?.displayName?.charAt(0) || profile?.email?.charAt(0) || 'U'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{profile?.displayName || 'User'}</p>
            <p className="truncate text-xs text-foreground-muted">{profile?.email}</p>
          </div>
        </div>
        <Button variant="outline" className="w-full justify-start text-foreground-muted" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
