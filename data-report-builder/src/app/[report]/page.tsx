'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, notFound } from 'next/navigation';
import { useApp, AppProvider, actions } from '@/state/app';
import { ThemeProvider } from '@/state/theme';
import { WarehouseProvider, useWarehouseStore } from '@/lib/useWarehouse';
import { fromSlug, ReportInfo } from '@/lib/slugs';
import { applyPreset, PRESET_CONFIGS, PresetKey } from '@/lib/presets';
import { ReportViewer } from '@/components/ReportViewer';
import { DevToolsMenu } from '@/components/DevToolsMenu';
import { useReportHeuristics } from '@/hooks/useReportHeuristics';
import { getGroupValues } from '@/lib/grouping';
import { convertReportToPreset } from '@/lib/reportToPreset';

// Groups for the star popover
const REPORT_GROUPS = [
  { id: 'starred', label: 'Starred' },
  { id: 'churn', label: 'Churn' },
  { id: 'new-subscriber-performance', label: 'New subscriber performance' },
  { id: 'drafts', label: 'Drafts' },
];

/**
 * Themed action button with hover state
 */
function ActionButton({ 
  children, 
  onClick, 
  ariaLabel, 
  isSquare = false,
  buttonRef,
  ariaExpanded,
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  ariaLabel: string;
  isSquare?: boolean;
  buttonRef?: React.RefObject<HTMLButtonElement>;
  ariaExpanded?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="flex items-center justify-center gap-2 text-sm font-medium transition-all"
      style={{
        backgroundColor: 'var(--bg-primary)',
        border: `1px solid ${isHovered ? 'var(--border-medium)' : 'var(--border-subtle)'}`,
        color: 'var(--text-primary)',
        borderRadius: '6px',
        cursor: 'pointer',
        height: '28px',
        width: isSquare ? '28px' : undefined,
        paddingLeft: isSquare ? undefined : '8px',
        paddingRight: isSquare ? undefined : '8px',
      }}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
    >
      {children}
    </button>
  );
}

/**
 * Action buttons component with star popover
 */
function ActionButtons({ onEditClick }: { onEditClick: () => void }) {
  const [starPopoverOpen, setStarPopoverOpen] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const starButtonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    if (!starPopoverOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        starButtonRef.current &&
        !starButtonRef.current.contains(event.target as Node)
      ) {
        setStarPopoverOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [starPopoverOpen]);

  // Close on escape key
  useEffect(() => {
    if (!starPopoverOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setStarPopoverOpen(false);
        starButtonRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [starPopoverOpen]);

  const toggleGroup = (groupId: string) => {
    setSelectedGroups(prev =>
      prev.includes(groupId) ? prev.filter(g => g !== groupId) : [...prev, groupId]
    );
  };

  return (
    <div className="flex items-center gap-2">
      {/* Export button */}
      <ActionButton ariaLabel="Export">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M7 1V9M7 1L4 4M7 1L10 4M1 10V12C1 12.5523 1.44772 13 2 13H12C12.5523 13 13 12.5523 13 12V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Export
      </ActionButton>
      
      {/* Share button - multiple users icon */}
      <ActionButton ariaLabel="Share">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Primary user */}
          <circle cx="5" cy="4" r="2" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M1 12C1 9.79086 2.79086 8 5 8C7.20914 8 9 9.79086 9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          {/* Secondary user (smaller, offset) */}
          <circle cx="10" cy="4.5" r="1.5" stroke="currentColor" strokeWidth="1.25"/>
          <path d="M8 12C8 10.3431 9.34315 9 11 9C12.1046 9 13 9.89543 13 11" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
        </svg>
        Share
      </ActionButton>
      
      {/* Star button with popover */}
      <div className="relative">
        <ActionButton 
          buttonRef={starButtonRef as React.RefObject<HTMLButtonElement>}
          onClick={() => setStarPopoverOpen(!starPopoverOpen)}
          ariaLabel="Add to groups"
          ariaExpanded={starPopoverOpen}
          isSquare
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path 
              d="M7 1L8.854 4.854L13 5.5L10 8.5L10.708 13L7 11L3.292 13L4 8.5L1 5.5L5.146 4.854L7 1Z" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              fill={selectedGroups.length > 0 ? 'currentColor' : 'none'}
            />
          </svg>
        </ActionButton>

        {/* Star Popover */}
        {starPopoverOpen && (
          <div
            ref={popoverRef}
            className="absolute z-50"
            style={{
              top: '100%',
              right: 0,
              marginTop: '8px',
              width: '280px',
              backgroundColor: 'var(--bg-elevated)',
              borderRadius: '12px',
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.12)',
            }}
          >
            {/* Header */}
            <div style={{ padding: '16px 16px 12px 16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Add report to groups
              </h3>
            </div>

            {/* Group list */}
            <div style={{ padding: '0 8px 8px 8px' }}>
              {REPORT_GROUPS.map((group) => {
                const isSelected = selectedGroups.includes(group.id);
                return (
                  <button
                    key={group.id}
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center justify-between transition-colors rounded-lg"
                    style={{ 
                      cursor: 'pointer', 
                      height: '40px', 
                      paddingLeft: '8px', 
                      paddingRight: '8px',
                      background: 'transparent',
                      border: 'none',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <span style={{ 
                      fontSize: '14px', 
                      fontWeight: 400, 
                      color: isSelected ? 'var(--button-primary-bg)' : 'var(--text-primary)' 
                    }}>
                      {group.label}
                    </span>
                    {isSelected ? (
                      // Filled checkmark circle
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--button-primary-bg)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M2.5 6L5 8.5L9.5 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    ) : (
                      // Empty plus circle
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          border: '1.5px solid var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M5 2V8M2 5H8" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Create new group link */}
            <div style={{ padding: '0 16px 12px 16px' }}>
              <button
                className="text-sm transition-colors"
                style={{ 
                  color: 'var(--text-secondary)', 
                  textDecoration: 'underline',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Create a new group
              </button>
            </div>

            {/* Done button */}
            <div style={{ padding: '0 16px 16px 16px' }}>
              <button
                onClick={() => setStarPopoverOpen(false)}
                className="w-full text-sm font-semibold transition-colors"
                style={{
                  backgroundColor: 'var(--button-primary-bg)',
                  color: 'var(--button-primary-text)',
                  borderRadius: '8px',
                  height: '40px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Edit button - no icon */}
      <ActionButton onClick={onEditClick} ariaLabel="Edit report">
        Edit
      </ActionButton>
      
      {/* More button */}
      <ActionButton ariaLabel="More options" isSquare>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="3" cy="7" r="1.25" fill="currentColor"/>
          <circle cx="7" cy="7" r="1.25" fill="currentColor"/>
          <circle cx="11" cy="7" r="1.25" fill="currentColor"/>
        </svg>
      </ActionButton>
    </div>
  );
}

/**
 * Detail page for viewing a report.
 * URL: /[report] (e.g., /mrr, /active-subscribers)
 */
function DetailPageContent({ reportInfo }: { reportInfo: ReportInfo }) {
  const { state, dispatch } = useApp();
  const { store: warehouse } = useWarehouseStore();
  const router = useRouter();
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [hasAppliedPreset, setHasAppliedPreset] = useState(false);

  // Enable automatic report switching based on object selection
  useReportHeuristics();

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

  // Apply the preset/template when warehouse data is loaded
  useEffect(() => {
    if (hasAppliedPreset) return;
    
    // Wait for warehouse to have some data
    const hasData = warehouse && Object.keys(warehouse).some(k => 
      Array.isArray(warehouse[k]) && warehouse[k].length > 0
    );
    
    if (!hasData) return;

    if (reportInfo.type === 'preset') {
      applyPreset(reportInfo.key as PresetKey, dispatch, state, warehouse);
    } else if (reportInfo.report) {
      const presetConfig = convertReportToPreset(reportInfo.report);
      applyPreset(presetConfig, dispatch, state, warehouse);
    }
    
    setHasAppliedPreset(true);
  }, [reportInfo, warehouse, dispatch, state, hasAppliedPreset]);

  // Auto-populate groupBy values when warehouse data loads
  useEffect(() => {
    const hasGroupBy = !!state.groupBy;
    const selectedValuesLength = state.groupBy?.selectedValues?.length || 0;
    const requiredObject = state.groupBy?.field?.object;
    const objectIsLoaded = requiredObject && warehouse?.[requiredObject] && Array.isArray(warehouse[requiredObject]);
    const objectRowCount = objectIsLoaded ? (warehouse[requiredObject] as any[]).length : 0;
    const primaryObject = state.selectedObjects[0] || state.metricFormula.blocks[0]?.source?.object;
    
    if (hasGroupBy && selectedValuesLength === 0 && objectIsLoaded && objectRowCount > 0) {
      const selectedValues = getGroupValues(warehouse, state.groupBy!.field, 10, primaryObject);
      if (selectedValues.length > 0) {
        dispatch(actions.updateGroupValues(selectedValues));
      }
    }
  }, [state.groupBy, state.selectedObjects, state.metricFormula.blocks, warehouse, dispatch]);

  const handleEditClick = () => {
    router.push(`/${reportInfo.slug}/edit`);
  };

  // Nav item component for cleaner code with hover states
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
        <div 
          className="flex items-center justify-between px-4 py-4"
        >
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
              isActive={false}
              onClick={() => router.push('/')}
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
              <NavItem
                hasChevron
                icon={
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 4L8 2L14 4V8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8V4Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                }
                label="Connect"
              />
              <NavItem
                hasChevron
                icon={
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="2" y="4" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M2 7H14" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                }
                label="Payments"
              />
              <NavItem
                hasChevron
                icon={
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M2 6H14M6 6V14" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                }
                label="Billing"
              />
              <NavItem
                hasChevron
                icon={
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 12V4M6 12V6M10 12V8M14 12V2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                }
                label="Reporting"
              />
              <NavItem
                hasChevron
                icon={
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="4" cy="8" r="1.5" fill="currentColor"/>
                    <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
                    <circle cx="12" cy="8" r="1.5" fill="currentColor"/>
                  </svg>
                }
                label="More"
              />
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
            {/* Help icon */}
            <button
              className="flex items-center justify-center"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
              aria-label="Help"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="8" cy="8" r="6.5" stroke="var(--text-secondary)" strokeWidth="1.5"/>
                <path d="M6.5 6.5C6.5 5.67157 7.17157 5 8 5C8.82843 5 9.5 5.67157 9.5 6.5C9.5 7.12345 9.10467 7.65287 8.55279 7.87639C8.214 8.01578 8 8.35726 8 8.72222V9" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="8" cy="11" r="0.75" fill="var(--text-secondary)"/>
              </svg>
            </button>

            {/* Notifications icon */}
            <button
              className="flex items-center justify-center"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
              aria-label="Notifications"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 1.5C5.51472 1.5 3.5 3.51472 3.5 6V9L2 11.5H14L12.5 9V6C12.5 3.51472 10.4853 1.5 8 1.5Z" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M6.5 11.5V12C6.5 12.8284 7.17157 13.5 8 13.5C8.82843 13.5 9.5 12.8284 9.5 12V11.5" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* Settings icon */}
            <button
              className="flex items-center justify-center"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
              aria-label="Settings"
            >
              <svg width="16" height="16" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M11.3679 4.49008C11.4069 4.50549 11.4446 4.52324 11.4809 4.54319C11.7919 4.71394 12 5.04437 12 5.42013V6.57987C12 6.95563 11.7919 7.28607 11.4809 7.45682C11.4446 7.47676 11.4069 7.49452 11.3679 7.50992C11.2788 7.54518 11.1831 7.56807 11.083 7.57641L10.2643 7.64464C10.2172 7.64856 10.1766 7.67895 10.1585 7.72256C10.1404 7.7662 10.1477 7.81636 10.1782 7.85242L10.7089 8.47957C10.7738 8.55627 10.8252 8.64012 10.8634 8.72813C10.88 8.76655 10.8941 8.80576 10.9057 8.84553C11.0048 9.18614 10.9183 9.56693 10.6526 9.83262L9.83255 10.6527C9.56688 10.9184 9.18612 11.0049 8.84552 10.9058C8.80574 10.8942 8.76651 10.8801 8.72807 10.8634C8.64006 10.8253 8.55621 10.7739 8.47951 10.709L7.85229 10.1782C7.81625 10.1477 7.76612 10.1405 7.72251 10.1586C7.67893 10.1766 7.64856 10.2172 7.64465 10.2642L7.57641 11.083C7.56807 11.1832 7.54517 11.2788 7.5099 11.368C7.49449 11.407 7.47673 11.4447 7.45677 11.481C7.28601 11.7919 6.9556 12 6.57987 12H5.42013C5.04437 12 4.71393 11.7919 4.54318 11.4809C4.52324 11.4446 4.50548 11.4069 4.49008 11.3679C4.45482 11.2788 4.43193 11.1831 4.42359 11.083L4.35536 10.2643C4.35144 10.2172 4.32105 10.1766 4.27744 10.1585C4.2338 10.1404 4.18365 10.1477 4.14758 10.1782L3.52044 10.7089C3.44374 10.7738 3.35989 10.8252 3.27187 10.8634C3.23345 10.88 3.19424 10.8941 3.15447 10.9057C2.81386 11.0048 2.43308 10.9183 2.16739 10.6526L1.34734 9.83255C1.08166 9.56687 0.995145 9.18612 1.09425 8.84552C1.10582 8.80574 1.11993 8.76651 1.13658 8.72807C1.1747 8.64006 1.22615 8.55621 1.29106 8.4795L1.82177 7.8523C1.85227 7.81625 1.85954 7.76613 1.84145 7.72252C1.82338 7.67893 1.78277 7.64856 1.73575 7.64465L0.916954 7.57641C0.816841 7.56807 0.721191 7.54517 0.632016 7.50991C0.593051 7.4945 0.555322 7.47673 0.518997 7.45678C0.208069 7.28602 0 6.9556 0 6.57987V5.42013C0 5.0444 0.208064 4.71399 0.518986 4.54323C0.555312 4.52327 0.593043 4.5055 0.63201 4.49009C0.721187 4.45483 0.816839 4.43193 0.916954 4.42359L1.73576 4.35535C1.78278 4.35143 1.82338 4.32107 1.84145 4.27749C1.85953 4.23388 1.85226 4.18376 1.82177 4.14772L1.29099 3.52044C1.22611 3.44376 1.17466 3.35994 1.13654 3.27195C1.11989 3.23351 1.10578 3.19427 1.0942 3.15448C0.995072 2.81387 1.08158 2.43308 1.34727 2.16739L2.16733 1.34734C2.43304 1.08163 2.81385 0.995126 3.15448 1.09428C3.19425 1.10586 3.23347 1.11996 3.27189 1.13661C3.35988 1.17473 3.4437 1.22617 3.52038 1.29106L4.14759 1.82177C4.18365 1.85229 4.23381 1.85956 4.27744 1.84147C4.32105 1.82338 4.35144 1.78276 4.35536 1.73571L4.42359 0.916955C4.43193 0.816855 4.45482 0.721218 4.49008 0.632054C4.50548 0.5931 4.52324 0.555382 4.54318 0.519067C4.71393 0.2081 5.04437 0 5.42013 0H6.57987C6.9556 0 7.28601 0.208066 7.45677 0.51899C7.47673 0.555316 7.4945 0.593046 7.50991 0.632012C7.54517 0.721189 7.56807 0.81684 7.57641 0.916955L7.64465 1.73576C7.64856 1.78277 7.67893 1.82338 7.72251 1.84145C7.76612 1.85953 7.81624 1.85226 7.85229 1.82177L8.47957 1.29099C8.55625 1.2261 8.64007 1.17467 8.72805 1.13655C8.7665 1.11989 8.80573 1.10578 8.84552 1.0942C9.18613 0.995063 9.56692 1.08157 9.83262 1.34727L10.6527 2.16732C10.9184 2.43303 11.0049 2.81385 10.9057 3.15448C10.8942 3.19425 10.88 3.23347 10.8634 3.27189C10.8253 3.35987 10.7738 3.44369 10.709 3.52037L10.1782 4.1476C10.1477 4.18366 10.1404 4.23381 10.1585 4.27745C10.1766 4.32105 10.2172 4.35144 10.2643 4.35536L11.083 4.42359C11.1831 4.43193 11.2788 4.45483 11.3679 4.49008ZM9.60613 2.88855L9.22399 3.34017C8.88369 3.74234 8.81087 4.29084 9.00388 4.75626C9.19623 5.22012 9.63459 5.55722 10.1605 5.60104L10.75 5.65017V6.34983L10.1605 6.39896C9.63458 6.44279 9.19623 6.77989 9.00388 7.24373C8.81087 7.70916 8.88368 8.25767 9.22399 8.65985L9.60607 9.11139L9.11133 9.60613L8.65972 9.224C8.25757 8.88372 7.70911 8.8109 7.24371 9.00389C6.77987 9.19623 6.44279 9.63457 6.39896 10.1604L6.34983 10.75H5.65017L5.60104 10.1605C5.55721 9.63459 5.22012 9.19623 4.75627 9.00388C4.29083 8.81087 3.74233 8.88369 3.34016 9.22399L2.88862 9.60606L2.39388 9.11132L2.776 8.65973C3.11628 8.25758 3.1891 7.70911 2.99611 7.24371C2.80377 6.77986 2.36543 6.44279 1.83956 6.39896L1.25 6.34983V5.65017L1.83957 5.60103C2.36543 5.55721 2.80377 5.22014 2.99611 4.7563C3.1891 4.29089 3.11628 3.74244 2.776 3.34029L2.39382 2.88862L2.88855 2.39388L3.34016 2.77601C3.74234 3.11631 4.29084 3.18913 4.75626 2.99612C5.22012 2.80377 5.55722 2.36541 5.60104 1.83952L5.65017 1.25H6.34983L6.39896 1.83957C6.44279 2.36543 6.77986 2.80377 7.2437 2.99611C7.70911 3.1891 8.25757 3.11628 8.65971 2.776L9.11139 2.39381L9.60613 2.88855Z" fill="var(--text-secondary)"/>
                <path fillRule="evenodd" clipRule="evenodd" d="M5.99996 7.25C6.69031 7.25 7.24996 6.69036 7.24996 6C7.24996 5.30964 6.69031 4.75 5.99996 4.75C5.3096 4.75 4.74996 5.30964 4.74996 6C4.74996 6.69036 5.3096 7.25 5.99996 7.25ZM5.99996 8.5C7.38067 8.5 8.49996 7.38071 8.49996 6C8.49996 4.61929 7.38067 3.5 5.99996 3.5C4.61925 3.5 3.49996 4.61929 3.49996 6C3.49996 7.38071 4.61925 8.5 5.99996 8.5Z" fill="var(--text-secondary)"/>
              </svg>
            </button>

            {/* Add/Create button - purple circle with plus */}
            <button
              className="flex items-center justify-center"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'var(--button-primary-bg)',
                border: 'none',
                cursor: 'pointer',
              }}
              aria-label="Create"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 3V13M3 8H13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </header>

        {/* Main content area with title and report viewer */}
        <main className="flex flex-col flex-1 overflow-hidden" role="main">
          {/* Report viewer */}
          <div className="flex-1 overflow-hidden min-w-0" style={{ paddingLeft: '40px' }}>
            <ReportViewer 
              showDataList={true} 
              padding="40px" 
              actionButtons={
                <ActionButtons onEditClick={handleEditClick} />
              }
            />
          </div>
        </main>
      </div>

      {/* Floating Dev Tools */}
      <DevToolsMenu loadingProgress={loadingProgress} showNewButton={true} />
    </div>
  );
}

function DetailPageWrapper() {
  const params = useParams();
  const slug = params.report as string;
  
  // Look up the report info from the slug
  const reportInfo = fromSlug(slug);
  
  if (!reportInfo) {
    notFound();
  }

  // Determine the preset key for WarehouseProvider
  const presetKey = reportInfo.type === 'preset' 
    ? reportInfo.key as PresetKey 
    : 'blank'; // Templates start with blank and apply config

  return (
    <WarehouseProvider presetKey={presetKey}>
      <DetailPageContent reportInfo={reportInfo} />
    </WarehouseProvider>
  );
}

export default function DetailPage() {
  return (
    <ThemeProvider>
      <AppProvider>
        <DetailPageWrapper />
      </AppProvider>
    </ThemeProvider>
  );
}

