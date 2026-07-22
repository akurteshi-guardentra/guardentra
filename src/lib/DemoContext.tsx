import React, { createContext, useContext, useState } from 'react';

export type DemoMode = 'dhs' | 'commerce' | 'epa';

interface DemoContextType {
  demoMode: DemoMode;
  setDemoMode: (mode: DemoMode) => void;
  getAgencyName: () => string;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [demoMode, setDemoModeState] = useState<DemoMode>(() => {
    return (localStorage.getItem('guardentra_demo_mode') as DemoMode) || 'dhs';
  });

  const setDemoMode = (mode: DemoMode) => {
    setDemoModeState(mode);
    localStorage.setItem('guardentra_demo_mode', mode);
  };

  const getAgencyName = () => {
    switch (demoMode) {
      case 'dhs': return 'Department of Homeland Security (DHS)';
      case 'commerce': return 'Department of Commerce';
      case 'epa': return 'Environmental Protection Agency (EPA)';
    }
  };

  return (
    <DemoContext.Provider value={{ demoMode, setDemoMode, getAgencyName }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error('useDemo must be used within a DemoProvider');
  }
  return context;
}
