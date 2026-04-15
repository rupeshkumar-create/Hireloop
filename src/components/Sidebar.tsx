import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Briefcase, LayoutDashboard, Settings, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';

export function Sidebar() {
  const { profile, logout, isImpersonating, stopImpersonating } = useAuth();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(true);

  const navItems = [
    { name: 'Daily Jobs', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Job Tracker', path: '/tracker', icon: Briefcase },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className={cn("relative flex h-screen flex-col border-r border-border bg-surface/50 backdrop-blur-sm transition-all duration-300 ease-in-out", isCollapsed ? "w-20" : "w-72")}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-[1.6rem] z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm hover:bg-surface-hover"
      >
        {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>

      <div className="flex h-[4.5rem] items-center border-b border-border px-5">
        <div className="flex items-center justify-center rounded-2xl bg-foreground p-2 shadow-[0_0_0_1px_var(--color-near-black)] shrink-0">
          <Briefcase className="h-4 w-4 text-surface" />
        </div>
        <div className={cn("ml-3 overflow-hidden transition-all duration-300 whitespace-nowrap", isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100")}>
          <span className="font-display text-2xl leading-none tracking-tight text-foreground">Hireschema</span>
          <p className="mt-0.5 text-[11px] uppercase tracking-[0.16em] text-foreground-muted">Remote Job Agent</p>
        </div>
      </div>
      
      {isImpersonating && !isCollapsed && (
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

      {isImpersonating && isCollapsed && (
        <div className="m-2 flex justify-center">
          <div className="h-2 w-2 rounded-full bg-[rgba(201,100,66,1)] shadow-[0_0_8px_rgba(201,100,66,0.8)]" title={`Impersonating: ${profile?.email}`} />
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-6">
        <nav className="space-y-2 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
            return (
              <Link
                key={item.name}
                to={item.path}
                title={isCollapsed ? item.name : undefined}
                className={cn(
                  "group flex items-center rounded-xl py-3 font-medium transition-colors",
                  isCollapsed ? "justify-center px-0" : "px-3 text-sm",
                  isActive
                    ? "bg-foreground text-background shadow-[0_0_0_1px_var(--color-near-black)] dark:bg-surface-hover dark:text-foreground"
                    : "text-foreground-muted hover:bg-surface-hover hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 shrink-0",
                    !isCollapsed && "mr-3 h-4 w-4",
                    isActive ? "text-background dark:text-foreground" : "text-foreground-muted group-hover:text-foreground"
                  )}
                />
                <span className={cn("truncate transition-all duration-300", isCollapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100")}>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-border p-3">
        <div className={cn("mb-4 flex items-center rounded-2xl border border-border bg-background/70 py-2", isCollapsed ? "justify-center px-0" : "px-3")}>
          {profile?.photoURL ? (
            <img src={profile.photoURL} alt="Profile" className={cn("rounded-full border border-border object-cover shrink-0", isCollapsed ? "h-8 w-8" : "mr-3 h-10 w-10")} referrerPolicy="no-referrer" />
          ) : (
            <div className={cn("flex items-center justify-center rounded-full bg-border font-medium text-foreground-muted shrink-0", isCollapsed ? "h-8 w-8 text-xs" : "mr-3 h-10 w-10 text-sm")}>
              {profile?.displayName?.charAt(0) || profile?.email?.charAt(0) || 'U'}
            </div>
          )}
          <div className={cn("min-w-0 flex-1 overflow-hidden transition-all duration-300", isCollapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100")}>
            <p className="truncate text-sm font-medium text-foreground">{profile?.displayName || 'User'}</p>
            <p className="truncate text-xs text-foreground-muted">{profile?.email}</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          title={isCollapsed ? "Sign Out" : undefined}
          className={cn("w-full transition-all", isCollapsed ? "justify-center px-0" : "justify-start text-foreground-muted")} 
          onClick={logout}
        >
          <LogOut className={cn("h-4 w-4 shrink-0", !isCollapsed && "mr-2")} />
          {!isCollapsed && <span>Sign Out</span>}
        </Button>
      </div>
    </div>
  );
}
