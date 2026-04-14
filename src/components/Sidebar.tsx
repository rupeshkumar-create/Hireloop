import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Briefcase, LayoutDashboard, Settings, LogOut } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';

export function Sidebar() {
  const { profile, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { name: 'Daily Jobs', path: '/', icon: LayoutDashboard },
    { name: 'Job Tracker', path: '/tracker', icon: Briefcase },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen w-64 flex-col border-r border-border bg-background/50">
      <div className="flex h-16 items-center px-6 border-b border-border">
        <div className="bg-foreground p-1.5 rounded-md mr-3">
          <Briefcase className="h-4 w-4 text-surface" />
        </div>
        <span className="text-lg font-semibold tracking-tight text-foreground">Hireschema</span>
      </div>
      
      <div className="flex-1 overflow-y-auto py-6">
        <nav className="space-y-1 px-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={cn(
                  "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-foreground text-surface" 
                    : "text-foreground-muted hover:bg-surface-hover hover:text-foreground"
                )}
              >
                <Icon className={cn("mr-3 h-4 w-4", isActive ? "text-surface" : "text-foreground-muted")} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-border p-4">
        <div className="flex items-center mb-4 px-2">
          {profile?.photoURL ? (
            <img src={profile.photoURL} alt="Profile" className="h-8 w-8 rounded-full mr-3 border border-border" referrerPolicy="no-referrer" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-border flex items-center justify-center mr-3 text-foreground-muted font-medium text-sm">
              {profile?.displayName?.charAt(0) || profile?.email?.charAt(0) || 'U'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{profile?.displayName || 'User'}</p>
            <p className="text-xs text-foreground-muted truncate">{profile?.email}</p>
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
