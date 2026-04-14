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
    <div className="flex h-screen w-64 flex-col border-r border-zinc-200 bg-zinc-50/50">
      <div className="flex h-16 items-center px-6 border-b border-zinc-200">
        <div className="bg-zinc-900 p-1.5 rounded-md mr-3">
          <Briefcase className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-semibold tracking-tight text-zinc-900">Hireschema</span>
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
                    ? "bg-zinc-900 text-white" 
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                )}
              >
                <Icon className={cn("mr-3 h-4 w-4", isActive ? "text-white" : "text-zinc-400")} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-zinc-200 p-4">
        <div className="flex items-center mb-4 px-2">
          {profile?.photoURL ? (
            <img src={profile.photoURL} alt="Profile" className="h-8 w-8 rounded-full mr-3 border border-zinc-200" referrerPolicy="no-referrer" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-zinc-200 flex items-center justify-center mr-3 text-zinc-700 font-medium text-sm">
              {profile?.displayName?.charAt(0) || profile?.email?.charAt(0) || 'U'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-900 truncate">{profile?.displayName || 'User'}</p>
            <p className="text-xs text-zinc-500 truncate">{profile?.email}</p>
          </div>
        </div>
        <Button variant="outline" className="w-full justify-start text-zinc-600" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
