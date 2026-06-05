import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { Button } from './button';

export function ThemeToggle({ isCollapsed }: { isCollapsed?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <Button
      type="button"
      variant="outline"
      size={isCollapsed ? "icon" : "default"}
      className={isCollapsed ? "h-10 w-10 rounded-full border-border bg-surface text-foreground shrink-0" : "w-full justify-start border-border bg-surface text-foreground"}
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className={isCollapsed ? "h-4 w-4" : "mr-2 h-4 w-4"} /> : <Moon className={isCollapsed ? "h-4 w-4" : "mr-2 h-4 w-4"} />}
      {!isCollapsed && <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>}
    </Button>
  );
}
