import React, { createContext, useContext, useMemo, useState } from 'react';

type AppChromeContextValue = {
  minimal: boolean;
  setMinimal: (value: boolean) => void;
};

const AppChromeContext = createContext<AppChromeContextValue | null>(null);

export function AppChromeProvider({ children }: { children: React.ReactNode }) {
  const [minimal, setMinimal] = useState(false);
  const value = useMemo(() => ({ minimal, setMinimal }), [minimal]);
  return <AppChromeContext.Provider value={value}>{children}</AppChromeContext.Provider>;
}

export function useAppChrome() {
  const ctx = useContext(AppChromeContext);
  if (!ctx) {
    return { minimal: false, setMinimal: () => {} };
  }
  return ctx;
}
