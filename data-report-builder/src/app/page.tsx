'use client';

import { ThemeProvider } from '@/state/theme';
import { AppProvider } from '@/state/app';
import { WarehouseProvider } from '@/lib/useWarehouse';
import { HomePageContent, HOME_ENTITIES } from '@/components/HomePageContent';

/**
 * Home page
 * URL: /
 */
export default function HomePage() {
  return (
    <ThemeProvider>
      <AppProvider>
        <WarehouseProvider initial={HOME_ENTITIES}>
          <HomePageContent />
        </WarehouseProvider>
      </AppProvider>
    </ThemeProvider>
  );
}
