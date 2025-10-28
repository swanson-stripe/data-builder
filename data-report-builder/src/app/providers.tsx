'use client';

import { ThemeProvider } from '@/state/theme';
import { AppProvider } from '@/state/app';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AppProvider>{children}</AppProvider>
    </ThemeProvider>
  );
}
