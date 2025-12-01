'use client';

import { useEffect, useState, useMemo } from 'react';
import { useApp, AppProvider, actions } from '@/state/app';
import { ThemeProvider } from '@/state/theme';
import { WarehouseProvider, useWarehouseStore } from '@/lib/useWarehouse';
import { DevToolsMenu } from '@/components/DevToolsMenu';
import { ReportWidget } from '@/components/ReportWidget';
import { PRESET_CONFIGS, PresetKey, applyPreset } from '@/lib/presets';
import { computeFormula } from '@/lib/formulaMetrics';
import { Granularity } from '@/lib/time';
import { currency } from '@/lib/format';
import schema from '@/data/schema';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

// Date range presets (same as ChartPanel)
type RangePreset = {
  label: string;
  getValue: () => { start: string; end: string };
};

const rangePresets: RangePreset[] = [
  {
    label: '1D',
    getValue: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 1);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    },
  },
  {
    label: '1W',
    getValue: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 7);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    },
  },
  {
    label: '1M',
    getValue: () => {
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - 1);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    },
  },
  {
    label: '3M',
    getValue: () => {
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - 3);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    },
  },
  {
    label: '1Y',
    getValue: () => {
      const end = new Date();
      const start = new Date();
      start.setFullYear(start.getFullYear() - 1);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    },
  },
  {
    label: 'YTD',
    getValue: () => {
      const end = new Date();
      const start = new Date(end.getFullYear(), 0, 1);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    },
  },
];

// Presets to display in the overview grid
const OVERVIEW_PRESETS: PresetKey[] = [
  'mrr',
  'gross_volume',
  'customer_acquisition',
  'active_subscribers',
  'refund_count',
  'subscriber_ltv',
];

// Collect all unique entities needed by the overview presets
// These map to the JSON data files in /public/data/
const ANALYTICS_ENTITIES = Array.from(new Set(
  OVERVIEW_PRESETS.flatMap(key => PRESET_CONFIGS[key].objects)
)) as Array<'charge' | 'customer' | 'subscription' | 'subscription_item' | 'price' | 'refund' | 'payment' | 'invoice'>;

// Labels for the overview widgets (can override preset labels)
const OVERVIEW_LABELS: Partial<Record<PresetKey, string>> = {
  gross_volume: 'Net volume',
  customer_acquisition: 'New customers',
  refund_count: 'Churned revenue',
};

/**
 * Analytics index page content
 */
function AnalyticsPageContent() {
  const { state, dispatch } = useApp();
  const { store: warehouse } = useWarehouseStore();
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [selectedRange, setSelectedRange] = useState('YTD');

  // Animate loading progress
  const isLoading = state.loadingComponents.size > 0;
  
  useEffect(() => {
    if (isLoading) {
      setLoadingProgress(1);
      const interval = setInterval(() => {
        setLoadingProgress((prev) => prev >= 90 ? 90 : prev + Math.random() * 15);
      }, 200);
      return () => clearInterval(interval);
    }
  }, [isLoading]);
  
  useEffect(() => {
    if (!isLoading && loadingProgress > 0) {
      setLoadingProgress(100);
      const timeout = setTimeout(() => setLoadingProgress(0), 500);
      return () => clearTimeout(timeout);
    }
  }, [isLoading, loadingProgress]);

  // Get current date range
  const currentRange = useMemo(() => {
    const preset = rangePresets.find(p => p.label === selectedRange);
    return preset ? preset.getValue() : rangePresets[5].getValue(); // Default to YTD
  }, [selectedRange]);

  // Compute Gross Volume for the Today section with placeholder data
  const grossVolumeData = useMemo(() => {
    // Generate realistic placeholder hourly data for visualization
    // Simulates typical payment volume pattern: lower at night, peaks during business hours
    const currentHour = new Date().getHours();
    const baseVolume = 15000; // Base volume in cents ($150)
    
    const hourlyData = Array.from({ length: 24 }, (_, i) => {
      // Only show data up to current hour
      if (i > currentHour) {
        return { hour: `${i}:00`, value: 0 };
      }
      
      // Simulate realistic hourly pattern
      let multiplier = 0.3; // Night hours baseline
      if (i >= 6 && i < 9) multiplier = 0.6; // Early morning ramp up
      else if (i >= 9 && i < 12) multiplier = 1.2; // Morning peak
      else if (i >= 12 && i < 14) multiplier = 0.9; // Lunch dip
      else if (i >= 14 && i < 18) multiplier = 1.1; // Afternoon
      else if (i >= 18 && i < 21) multiplier = 0.8; // Evening
      else if (i >= 21) multiplier = 0.4; // Late night
      
      // Add some randomness
      const randomFactor = 0.7 + Math.random() * 0.6;
      const value = Math.round(baseVolume * multiplier * randomFactor);
      
      return { hour: `${i}:00`, value };
    });

    // Sum up the current value
    const currentValue = hourlyData.reduce((sum, d) => sum + d.value, 0);

    return {
      chartData: hourlyData,
      currentValue,
    };
  }, []);

  // Handle range change - uses same action as ChartPanel
  const handleRangeChange = (label: string) => {
    setSelectedRange(label);
    const preset = rangePresets.find(p => p.label === label);
    if (preset) {
      const { start, end } = preset.getValue();
      dispatch(actions.setRange(start, end));
    }
  };

  // Nav item component with hover states
  const NavItem = ({ icon, label, isActive = false, hasChevron = false, onClick }: { icon: React.ReactNode; label: string; isActive?: boolean; hasChevron?: boolean; onClick?: () => void }) => {
    const [isHovered, setIsHovered] = useState(false);
    
    return (
      <button
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="flex items-center justify-between w-full px-3 py-2 rounded-md transition-colors"
        style={{
          backgroundColor: isHovered ? 'var(--bg-surface)' : 'transparent',
          color: isActive ? 'var(--accent-text)' : 'var(--text-primary)',
          border: 'none',
          cursor: 'pointer',
          fontWeight: isActive ? 500 : 400,
          fontSize: '14px',
        }}
      >
        <div className="flex items-center gap-3">
          {icon}
          <span>{label}</span>
        </div>
        {hasChevron && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4.5 3L7.5 6L4.5 9" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>
    );
  };

  return (
    <div className="h-screen flex" style={{ backgroundColor: 'var(--bg-primary)', overflow: 'hidden' }}>
      {/* Left Navigation Panel */}
      <nav
        className="flex flex-col h-full"
        style={{
          width: '240px',
          flexShrink: 0,
          borderRight: '1px solid var(--border-default)',
          backgroundColor: 'var(--bg-primary)',
        }}
      >
        {/* Account Selector */}
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                backgroundColor: 'var(--button-primary-bg)',
              }}
            />
            <span style={{ fontWeight: 500, fontSize: '14px', color: 'var(--text-primary)' }}>Stripe Shop</span>
          </div>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {/* Main Navigation */}
        <div className="flex-1 overflow-y-auto py-4 px-3">
          {/* Primary Nav Items */}
          <div className="flex flex-col gap-1">
            <NavItem
              isActive={true}
              icon={
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 6L8 2L14 6V13C14 13.5523 13.5523 14 13 14H3C2.44772 14 2 13.5523 2 13V6Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M6 14V8H10V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              }
              label="Home"
            />
            <NavItem
              icon={
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 4H14M2 8H10M2 12H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              }
              label="Balances"
            />
            <NavItem
              icon={
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 6L8 2L12 6M12 10L8 14L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              }
              label="Transactions"
            />
            <NavItem
              icon={
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M2 14C2 11.2386 4.68629 9 8 9C11.3137 9 14 11.2386 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              }
              label="Customers"
            />
            <NavItem
              icon={
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M5 6H11M5 8H11M5 10H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              }
              label="Product catalog"
            />
          </div>

          {/* Products Section */}
          <div className="mt-6">
            <div className="px-3 py-2">
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Products</span>
            </div>
            <div className="flex flex-col gap-1">
              <NavItem hasChevron icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4L8 2L14 4V8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8V4Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>} label="Connect" />
              <NavItem hasChevron icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="4" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.5"/><path d="M2 7H14" stroke="currentColor" strokeWidth="1.5"/></svg>} label="Payments" />
              <NavItem hasChevron icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.5"/><path d="M2 6H14M6 6V14" stroke="currentColor" strokeWidth="1.5"/></svg>} label="Billing" />
              <NavItem hasChevron icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 12V4M6 12V6M10 12V8M14 12V2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>} label="Reporting" />
              <NavItem hasChevron icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="4" cy="8" r="1.5" fill="currentColor"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><circle cx="12" cy="8" r="1.5" fill="currentColor"/></svg>} label="More" />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top Navigation Bar */}
        <header 
          className="flex items-center justify-between" 
          style={{ 
            height: '56px', 
            backgroundColor: 'var(--bg-primary)', 
            borderBottom: '1px solid var(--border-default)', 
            paddingLeft: '40px', 
            paddingRight: '40px' 
          }} 
          role="banner"
        >
          {/* Search Bar */}
          <div 
            className="flex items-center gap-2"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: '8px',
              padding: '8px 12px',
              width: '320px',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 12C9.76142 12 12 9.76142 12 7C12 4.23858 9.76142 2 7 2C4.23858 2 2 4.23858 2 7C2 9.76142 4.23858 12 7 12Z" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14 14L10.5 10.5" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Search</span>
          </div>

          {/* Right side icons */}
          <div className="flex items-center gap-2">
            <button className="flex items-center justify-center" style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }} aria-label="Help">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="var(--text-secondary)" strokeWidth="1.5"/><path d="M6.5 6.5C6.5 5.67157 7.17157 5 8 5C8.82843 5 9.5 5.67157 9.5 6.5C9.5 7.12345 9.10467 7.65287 8.55279 7.87639C8.214 8.01578 8 8.35726 8 8.72222V9" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="11" r="0.75" fill="var(--text-secondary)"/></svg>
            </button>
            <button className="flex items-center justify-center" style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }} aria-label="Notifications">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5C5.51472 1.5 3.5 3.51472 3.5 6V9L2 11.5H14L12.5 9V6C12.5 3.51472 10.4853 1.5 8 1.5Z" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M6.5 11.5V12C6.5 12.8284 7.17157 13.5 8 13.5C8.82843 13.5 9.5 12.8284 9.5 12V11.5" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button className="flex items-center justify-center" style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }} aria-label="Settings">
              <svg width="16" height="16" viewBox="0 0 12 12" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M11.3679 4.49008C11.4069 4.50549 11.4446 4.52324 11.4809 4.54319C11.7919 4.71394 12 5.04437 12 5.42013V6.57987C12 6.95563 11.7919 7.28607 11.4809 7.45682C11.4446 7.47676 11.4069 7.49452 11.3679 7.50992C11.2788 7.54518 11.1831 7.56807 11.083 7.57641L10.2643 7.64464C10.2172 7.64856 10.1766 7.67895 10.1585 7.72256C10.1404 7.7662 10.1477 7.81636 10.1782 7.85242L10.7089 8.47957C10.7738 8.55627 10.8252 8.64012 10.8634 8.72813C10.88 8.76655 10.8941 8.80576 10.9057 8.84553C11.0048 9.18614 10.9183 9.56693 10.6526 9.83262L9.83255 10.6527C9.56688 10.9184 9.18612 11.0049 8.84552 10.9058C8.80574 10.8942 8.76651 10.8801 8.72807 10.8634C8.64006 10.8253 8.55621 10.7739 8.47951 10.709L7.85229 10.1782C7.81625 10.1477 7.76612 10.1405 7.72251 10.1586C7.67893 10.1766 7.64856 10.2172 7.64465 10.2642L7.57641 11.083C7.56807 11.1832 7.54517 11.2788 7.5099 11.368C7.49449 11.407 7.47673 11.4447 7.45677 11.481C7.28601 11.7919 6.9556 12 6.57987 12H5.42013C5.04437 12 4.71393 11.7919 4.54318 11.4809C4.52324 11.4446 4.50548 11.4069 4.49008 11.3679C4.45482 11.2788 4.43193 11.1831 4.42359 11.083L4.35536 10.2643C4.35144 10.2172 4.32105 10.1766 4.27744 10.1585C4.2338 10.1404 4.18365 10.1477 4.14758 10.1782L3.52044 10.7089C3.44374 10.7738 3.35989 10.8252 3.27187 10.8634C3.23345 10.88 3.19424 10.8941 3.15447 10.9057C2.81386 11.0048 2.43308 10.9183 2.16739 10.6526L1.34734 9.83255C1.08166 9.56687 0.995145 9.18612 1.09425 8.84552C1.10582 8.80574 1.11993 8.76651 1.13658 8.72807C1.1747 8.64006 1.22615 8.55621 1.29106 8.4795L1.82177 7.8523C1.85227 7.81625 1.85954 7.76613 1.84145 7.72252C1.82338 7.67893 1.78277 7.64856 1.73575 7.64465L0.916954 7.57641C0.816841 7.56807 0.721191 7.54517 0.632016 7.50991C0.593051 7.4945 0.555322 7.47673 0.518997 7.45678C0.208069 7.28602 0 6.9556 0 6.57987V5.42013C0 5.0444 0.208064 4.71399 0.518986 4.54323C0.555312 4.52327 0.593043 4.5055 0.63201 4.49009C0.721187 4.45483 0.816839 4.43193 0.916954 4.42359L1.73576 4.35535C1.78278 4.35143 1.82338 4.32107 1.84145 4.27749C1.85953 4.23388 1.85226 4.18376 1.82177 4.14772L1.29099 3.52044C1.22611 3.44376 1.17466 3.35994 1.13654 3.27195C1.11989 3.23351 1.10578 3.19427 1.0942 3.15448C0.995072 2.81387 1.08158 2.43308 1.34727 2.16739L2.16733 1.34734C2.43304 1.08163 2.81385 0.995126 3.15448 1.09428C3.19425 1.10586 3.23347 1.11996 3.27189 1.13661C3.35988 1.17473 3.4437 1.22617 3.52038 1.29106L4.14759 1.82177C4.18365 1.85229 4.23381 1.85956 4.27744 1.84147C4.32105 1.82338 4.35144 1.78276 4.35536 1.73571L4.42359 0.916955C4.43193 0.816855 4.45482 0.721218 4.49008 0.632054C4.50548 0.5931 4.52324 0.555382 4.54318 0.519067C4.71393 0.2081 5.04437 0 5.42013 0H6.57987C6.9556 0 7.28601 0.208066 7.45677 0.51899C7.47673 0.555316 7.4945 0.593046 7.50991 0.632012C7.54517 0.721189 7.56807 0.81684 7.57641 0.916955L7.64465 1.73576C7.64856 1.78277 7.67893 1.82338 7.72251 1.84145C7.76612 1.85953 7.81624 1.85226 7.85229 1.82177L8.47957 1.29099C8.55625 1.2261 8.64007 1.17467 8.72805 1.13655C8.7665 1.11989 8.80573 1.10578 8.84552 1.0942C9.18613 0.995063 9.56692 1.08157 9.83262 1.34727L10.6527 2.16732C10.9184 2.43303 11.0049 2.81385 10.9057 3.15448C10.8942 3.19425 10.88 3.23347 10.8634 3.27189C10.8253 3.35987 10.7738 3.44369 10.709 3.52037L10.1782 4.1476C10.1477 4.18366 10.1404 4.23381 10.1585 4.27745C10.1766 4.32105 10.2172 4.35144 10.2643 4.35536L11.083 4.42359C11.1831 4.43193 11.2788 4.45483 11.3679 4.49008ZM9.60613 2.88855L9.22399 3.34017C8.88369 3.74234 8.81087 4.29084 9.00388 4.75626C9.19623 5.22012 9.63459 5.55722 10.1605 5.60104L10.75 5.65017V6.34983L10.1605 6.39896C9.63458 6.44279 9.19623 6.77989 9.00388 7.24373C8.81087 7.70916 8.88368 8.25767 9.22399 8.65985L9.60607 9.11139L9.11133 9.60613L8.65972 9.224C8.25757 8.88372 7.70911 8.8109 7.24371 9.00389C6.77987 9.19623 6.44279 9.63457 6.39896 10.1604L6.34983 10.75H5.65017L5.60104 10.1605C5.55721 9.63459 5.22012 9.19623 4.75627 9.00388C4.29083 8.81087 3.74233 8.88369 3.34016 9.22399L2.88862 9.60606L2.39388 9.11132L2.776 8.65973C3.11628 8.25758 3.1891 7.70911 2.99611 7.24371C2.80377 6.77986 2.36543 6.44279 1.83956 6.39896L1.25 6.34983V5.65017L1.83957 5.60103C2.36543 5.55721 2.80377 5.22014 2.99611 4.7563C3.1891 4.29089 3.11628 3.74244 2.776 3.34029L2.39382 2.88862L2.88855 2.39388L3.34016 2.77601C3.74234 3.11631 4.29084 3.18913 4.75626 2.99612C5.22012 2.80377 5.55722 2.36541 5.60104 1.83952L5.65017 1.25H6.34983L6.39896 1.83957C6.44279 2.36543 6.77986 2.80377 7.2437 2.99611C7.70911 3.1891 8.25757 3.11628 8.65971 2.776L9.11139 2.39381L9.60613 2.88855Z" fill="var(--text-secondary)"/><path fillRule="evenodd" clipRule="evenodd" d="M5.99996 7.25C6.69031 7.25 7.24996 6.69036 7.24996 6C7.24996 5.30964 6.69031 4.75 5.99996 4.75C5.3096 4.75 4.74996 5.30964 4.74996 6C4.74996 6.69036 5.3096 7.25 5.99996 7.25ZM5.99996 8.5C7.38067 8.5 8.49996 7.38071 8.49996 6C8.49996 4.61929 7.38067 3.5 5.99996 3.5C4.61925 3.5 3.49996 4.61929 3.49996 6C3.49996 7.38071 4.61925 8.5 5.99996 8.5Z" fill="var(--text-secondary)"/></svg>
            </button>
            <button className="flex items-center justify-center" style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--button-primary-bg)', border: 'none', cursor: 'pointer' }} aria-label="Create">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 3V13M3 8H13" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto" style={{ padding: '40px' }}>
          {/* Today Section */}
          <section className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Today</h1>
              <button
                className="text-sm font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                }}
              >
                Pay out funds
              </button>
            </div>

            <div className="flex gap-6">
              {/* Chart area */}
              <div 
                className="flex-1"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                }}
              >
                <div className="flex items-start mb-4" style={{ gap: '40px' }}>
                  {/* Today's gross volume */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Gross volume</span>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M3 4.5L6 7.5L9 4.5" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {currency(grossVolumeData.currentValue)}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </div>
                  </div>
                  {/* Previous day's gross volume */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                        {(() => {
                          const yesterday = new Date();
                          yesterday.setDate(yesterday.getDate() - 1);
                          return yesterday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                        })()}
                      </span>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M3 4.5L6 7.5L9 4.5" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>$4,521.80</div>
                  </div>
                </div>

                {/* Chart */}
                <div style={{ height: '120px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={grossVolumeData.chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                      <XAxis 
                        dataKey="hour" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                        interval="preserveStartEnd"
                      />
                      <YAxis hide />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="var(--button-primary-bg)"
                        fill="var(--button-primary-bg)"
                        fillOpacity={0.1}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex justify-between mt-2">
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>12:00 AM</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>11:59 PM</span>
                </div>
              </div>

              {/* Balance & Debits cards */}
              <div className="flex flex-col gap-4" style={{ width: '280px' }}>
                {/* USD Balance */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '12px',
                    padding: '16px',
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>USD balance</span>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M3 4.5L6 7.5L9 4.5" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--button-primary-bg)', cursor: 'pointer' }}>View</span>
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>$254,795.41</div>
                </div>

                {/* Debits */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '12px',
                    padding: '16px',
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Debits</span>
                    <span style={{ fontSize: '12px', color: 'var(--button-primary-bg)', cursor: 'pointer' }}>View</span>
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>$41.60</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Debited Nov 25, 2024
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Your Overview Section */}
          <section>
            {/* Header */}
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, marginBottom: '16px' }}>Your overview</h2>
            
            {/* Controls row - datepicker left, buttons right */}
            <div className="flex items-center justify-between mb-6">
              {/* Date range picker - matches ChartPanel styling */}
              <div 
                className="flex items-center gap-1 px-1"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: '50px',
                  height: '32px',
                }}
              >
                {rangePresets.map((preset) => {
                  const isSelected = selectedRange === preset.label;
                  return (
                    <button
                      key={preset.label}
                      onClick={() => handleRangeChange(preset.label)}
                      className="text-sm font-medium transition-colors focus:outline-none"
                      style={{
                        backgroundColor: isSelected ? 'var(--bg-active)' : 'transparent',
                        borderRadius: '50px',
                        color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)',
                        height: '24px',
                        paddingLeft: '8px',
                        paddingRight: '8px',
                        cursor: 'pointer',
                        border: 'none',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = 'var(--bg-active)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                      aria-label={`Set date range to ${preset.label}`}
                      aria-pressed={isSelected}
                    >
                      {preset.label}
                    </button>
                  );
                })}
                {/* Divider */}
                <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-subtle)' }} />
                {/* Chevron button */}
                <button
                  className="flex items-center justify-center border-none focus:outline-none cursor-pointer transition-colors"
                  style={{
                    backgroundColor: 'transparent',
                    borderRadius: '50px',
                    width: '24px',
                    height: '24px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-active)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  aria-label="Open date range options"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>

              {/* Add and Edit buttons */}
              <div className="flex items-center gap-3">
                <button
                  className="flex items-center gap-2 text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    cursor: 'pointer',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 2V10M2 6H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  Add
                </button>
                <button
                  className="flex items-center gap-2 text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    cursor: 'pointer',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Edit
                </button>
              </div>
            </div>

            {/* Widget Grid */}
            <div 
              className="grid gap-4"
              style={{
                gridTemplateColumns: 'repeat(3, 1fr)',
              }}
            >
              {OVERVIEW_PRESETS.map((presetKey) => (
                <ReportWidget
                  key={presetKey}
                  presetKey={presetKey}
                  label={OVERVIEW_LABELS[presetKey]}
                />
              ))}
            </div>
          </section>
        </main>
      </div>

      {/* Floating Dev Tools */}
      <DevToolsMenu loadingProgress={loadingProgress} showNewButton={true} />
    </div>
  );
}

/**
 * Analytics index page
 * URL: /
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
