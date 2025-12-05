'use client';

import { ThemeProvider } from '@/state/theme';
import { AppProvider } from '@/state/app';
import { WarehouseProvider } from '@/lib/useWarehouse';
import { AnalyticsPageContent, ANALYTICS_ENTITIES } from '@/components/AnalyticsPageContent';

/**
 * Analytics page
 * URL: /analytics
 */
export default function AnalyticsPage() {
  return (
    <ThemeProvider>
      <AppProvider>
        <WarehouseProvider initial={ANALYTICS_ENTITIES}>
          <AnalyticsPageContent />
        </WarehouseProvider>
      </AppProvider>
    </ThemeProvider>
  );
}
