import React, { createContext, useCallback, useContext, useState } from 'react';

type AppDrawerContextType = {
  isOpen: boolean;
  open:   () => void;
  close:  () => void;
};

const AppDrawerContext = createContext<AppDrawerContextType | null>(null);

export function AppDrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open  = useCallback(() => setIsOpen(true),  []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <AppDrawerContext.Provider value={{ isOpen, open, close }}>
      {children}
    </AppDrawerContext.Provider>
  );
}

export function useAppDrawer(): AppDrawerContextType {
  const ctx = useContext(AppDrawerContext);
  if (!ctx) throw new Error('useAppDrawer must be used within AppDrawerProvider');
  return ctx;
}
