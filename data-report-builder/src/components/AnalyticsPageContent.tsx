'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp, actions } from '@/state/app';
import { useWarehouseStore } from '@/lib/useWarehouse';
import { DevToolsMenu } from '@/components/DevToolsMenu';
import { ReportWidget } from '@/components/ReportWidget';
import { PRESET_CONFIGS, PresetKey } from '@/lib/presets';
import { computeFormula } from '@/lib/formulaMetrics';
import { currency, number as formatNumber } from '@/lib/format';
import { toSlug } from '@/lib/slugs';
import schema from '@/data/schema';
import {
  ResponsiveContainer,
  LineChart,
  Line,
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
  'net_volume',
  'customer_acquisition',
  'active_subscribers',
  'refund_count',
  'subscriber_ltv',
];

// Starred section presets - displayed in the top section toggles
// Order: Gross volume, ARPU, Active subscribers, New customers by country, MRR, Refund count
const STARRED_PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'gross_volume', label: 'Gross volume' },
  { key: 'subscriber_ltv', label: 'ARPU' },
  { key: 'active_subscribers', label: 'Active subscribers' },
  { key: 'customer_acquisition', label: 'New customers' },
  { key: 'mrr', label: 'MRR' },
  { key: 'refund_count', label: 'Refund count' },
];

// Collect all unique entities needed by the overview and starred presets
// These map to the JSON data files in /public/data/
export const ANALYTICS_ENTITIES = Array.from(new Set([
  ...OVERVIEW_PRESETS.flatMap(key => PRESET_CONFIGS[key].objects),
  ...STARRED_PRESETS.flatMap(p => PRESET_CONFIGS[p.key].objects),
  'balance_transaction', // For net_volume widget
])) as Array<'charge' | 'customer' | 'subscription' | 'subscription_item' | 'price' | 'refund' | 'payment' | 'invoice' | 'balance_transaction'>;

// Labels for the overview widgets (can override preset labels)
const OVERVIEW_LABELS: Partial<Record<PresetKey, string>> = {
  customer_acquisition: 'New customers',
  refund_count: 'Churned revenue',
};

// Expandable action button component
interface ExpandableButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
}

function ExpandableButton({ icon, label, onClick, href }: ExpandableButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  const buttonContent = (
    <>
      {icon}
      <span
        style={{
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          maxWidth: isHovered ? '80px' : '0px',
          opacity: isHovered ? 1 : 0,
          marginLeft: isHovered ? '8px' : '0px',
          transition: 'all 200ms ease-in-out',
        }}
      >
        {label}
      </span>
    </>
  );

  const buttonStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-surface)',
    border: isHovered ? '1px solid #B6C0CD' : '1px solid var(--border-default)',
    color: 'var(--text-secondary)',
    borderRadius: '10px',
    padding: '7px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'all 200ms ease-in-out',
    textDecoration: 'none',
    height: '32px',
    width: isHovered ? 'auto' : '32px',
    boxSizing: 'border-box',
  };

  if (href) {
    return (
      <Link
        href={href}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={buttonStyle}
      >
        {buttonContent}
      </Link>
    );
  }

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={buttonStyle}
    >
      {buttonContent}
    </button>
  );
}

// Settings icon component (12px)
const SettingsIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
    <path fillRule="evenodd" clipRule="evenodd" d="M11.3679 4.49008C11.4069 4.50549 11.4446 4.52324 11.4809 4.54319C11.7919 4.71394 12 5.04437 12 5.42013V6.57987C12 6.95563 11.7919 7.28607 11.4809 7.45682C11.4446 7.47676 11.4069 7.49452 11.3679 7.50992C11.2788 7.54518 11.1831 7.56807 11.083 7.57641L10.2643 7.64464C10.2172 7.64856 10.1766 7.67895 10.1585 7.72256C10.1404 7.7662 10.1477 7.81636 10.1782 7.85242L10.7089 8.47957C10.7738 8.55627 10.8252 8.64012 10.8634 8.72813C10.88 8.76655 10.8941 8.80576 10.9057 8.84553C11.0048 9.18614 10.9183 9.56693 10.6526 9.83262L9.83255 10.6527C9.56688 10.9184 9.18612 11.0049 8.84552 10.9058C8.80574 10.8942 8.76651 10.8801 8.72807 10.8634C8.64006 10.8253 8.55621 10.7739 8.47951 10.709L7.85229 10.1782C7.81625 10.1477 7.76612 10.1405 7.72251 10.1586C7.67893 10.1766 7.64856 10.2172 7.64465 10.2642L7.57641 11.083C7.56807 11.1832 7.54517 11.2788 7.5099 11.368C7.49449 11.407 7.47673 11.4447 7.45677 11.481C7.28601 11.7919 6.9556 12 6.57987 12H5.42013C5.04437 12 4.71393 11.7919 4.54318 11.4809C4.52324 11.4446 4.50548 11.4069 4.49008 11.3679C4.45482 11.2788 4.43193 11.1831 4.42359 11.083L4.35536 10.2643C4.35144 10.2172 4.32105 10.1766 4.27744 10.1585C4.2338 10.1404 4.18365 10.1477 4.14758 10.1782L3.52044 10.7089C3.44374 10.7738 3.35989 10.8252 3.27187 10.8634C3.23345 10.88 3.19424 10.8941 3.15447 10.9057C2.81386 11.0048 2.43308 10.9183 2.16739 10.6526L1.34734 9.83255C1.08166 9.56687 0.995145 9.18612 1.09425 8.84552C1.10582 8.80574 1.11993 8.76651 1.13658 8.72807C1.1747 8.64006 1.22615 8.55621 1.29106 8.4795L1.82177 7.8523C1.85227 7.81625 1.85954 7.76613 1.84145 7.72252C1.82338 7.67893 1.78277 7.64856 1.73575 7.64465L0.916954 7.57641C0.816841 7.56807 0.721191 7.54517 0.632016 7.50991C0.593051 7.4945 0.555322 7.47673 0.518997 7.45678C0.208069 7.28602 0 6.9556 0 6.57987V5.42013C0 5.0444 0.208064 4.71399 0.518986 4.54323C0.555312 4.52327 0.593043 4.5055 0.63201 4.49009C0.721187 4.45483 0.816839 4.43193 0.916954 4.42359L1.73576 4.35535C1.78278 4.35143 1.82338 4.32107 1.84145 4.27749C1.85953 4.23388 1.85226 4.18376 1.82177 4.14772L1.29099 3.52044C1.22611 3.44376 1.17466 3.35994 1.13654 3.27195C1.11989 3.23351 1.10578 3.19427 1.0942 3.15448C0.995072 2.81387 1.08158 2.43308 1.34727 2.16739L2.16733 1.34734C2.43304 1.08163 2.81385 0.995126 3.15448 1.09428C3.19425 1.10586 3.23347 1.11996 3.27189 1.13661C3.35988 1.17473 3.4437 1.22617 3.52038 1.29106L4.14759 1.82177C4.18365 1.85229 4.23381 1.85956 4.27744 1.84147C4.32105 1.82338 4.35144 1.78276 4.35536 1.73571L4.42359 0.916955C4.43193 0.816855 4.45482 0.721218 4.49008 0.632054C4.50548 0.5931 4.52324 0.555382 4.54318 0.519067C4.71393 0.2081 5.04437 0 5.42013 0H6.57987C6.9556 0 7.28601 0.208066 7.45677 0.51899C7.47673 0.555316 7.4945 0.593046 7.50991 0.632012C7.54517 0.721189 7.56807 0.81684 7.57641 0.916955L7.64465 1.73576C7.64856 1.78277 7.67893 1.82338 7.72251 1.84145C7.76612 1.85953 7.81624 1.85226 7.85229 1.82177L8.47957 1.29099C8.55625 1.2261 8.64007 1.17467 8.72805 1.13655C8.7665 1.11989 8.80573 1.10578 8.84552 1.0942C9.18613 0.995063 9.56692 1.08157 9.83262 1.34727L10.6527 2.16732C10.9184 2.43303 11.0049 2.81385 10.9057 3.15448C10.8942 3.19425 10.88 3.23347 10.8634 3.27189C10.8253 3.35987 10.7738 3.44369 10.709 3.52037L10.1782 4.1476C10.1477 4.18366 10.1404 4.23381 10.1585 4.27745C10.1766 4.32105 10.2172 4.35144 10.2643 4.35536L11.083 4.42359C11.1831 4.43193 11.2788 4.45483 11.3679 4.49008ZM9.60613 2.88855L9.22399 3.34017C8.88369 3.74234 8.81087 4.29084 9.00388 4.75626C9.19623 5.22012 9.63459 5.55722 10.1605 5.60104L10.75 5.65017V6.34983L10.1605 6.39896C9.63458 6.44279 9.19623 6.77989 9.00388 7.24373C8.81087 7.70916 8.88368 8.25767 9.22399 8.65985L9.60607 9.11139L9.11133 9.60613L8.65972 9.224C8.25757 8.88372 7.70911 8.8109 7.24371 9.00389C6.77987 9.19623 6.44279 9.63457 6.39896 10.1604L6.34983 10.75H5.65017L5.60104 10.1605C5.55721 9.63459 5.22012 9.19623 4.75627 9.00388C4.29083 8.81087 3.74233 8.88369 3.34016 9.22399L2.88862 9.60606L2.39388 9.11132L2.776 8.65973C3.11628 8.25758 3.1891 7.70911 2.99611 7.24371C2.80377 6.77986 2.36543 6.44279 1.83956 6.39896L1.25 6.34983V5.65017L1.83957 5.60103C2.36543 5.55721 2.80377 5.22014 2.99611 4.7563C3.1891 4.29089 3.11628 3.74244 2.776 3.34029L2.39382 2.88862L2.88855 2.39388L3.34016 2.77601C3.74234 3.11631 4.29084 3.18913 4.75626 2.99612C5.22012 2.80377 5.55722 2.36541 5.60104 1.83952L5.65017 1.25H6.34983L6.39896 1.83957C6.44279 2.36543 6.77986 2.80377 7.2437 2.99611C7.70911 3.1891 8.25757 3.11628 8.65971 2.776L9.11139 2.39381L9.60613 2.88855Z" fill="currentColor"/><path fillRule="evenodd" clipRule="evenodd" d="M5.99996 7.25C6.69031 7.25 7.24996 6.69036 7.24996 6C7.24996 5.30964 6.69031 4.75 5.99996 4.75C5.3096 4.75 4.74996 5.30964 4.74996 6C4.74996 6.69036 5.3096 7.25 5.99996 7.25ZM5.99996 8.5C7.38067 8.5 8.49996 7.38071 8.49996 6C8.49996 4.61929 7.38067 3.5 5.99996 3.5C4.61925 3.5 3.49996 4.61929 3.49996 6C3.49996 7.38071 4.61925 8.5 5.99996 8.5Z" fill="currentColor"/>
  </svg>
);

// Toggle settings popover menu item
interface PopoverMenuItemProps {
  label: string;
  onClick: () => void;
}

function PopoverMenuItem({ label, onClick }: PopoverMenuItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'block',
        width: '100%',
        padding: '12px 16px',
        textAlign: 'left',
        backgroundColor: isHovered ? 'var(--bg-surface)' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontSize: '15px',
        fontWeight: 400,
        color: 'var(--text-primary)',
        transition: 'background-color 150ms ease',
      }}
    >
      {label}
    </button>
  );
}

// Toggle settings popover
interface ToggleSettingsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  isOwner: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
}

function ToggleSettingsPopover({ isOpen, onClose, isOwner, anchorRef }: ToggleSettingsPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Calculate position based on anchor element
  useEffect(() => {
    if (isOpen && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      const popoverWidth = 180;
      setPosition({
        top: rect.bottom + 4,
        left: rect.left + (rect.width / 2) - (popoverWidth / 2), // Center align with anchor
      });
    }
  }, [isOpen, anchorRef]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const timeout = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        backgroundColor: 'var(--bg-primary)',
        border: '1px solid var(--border-default)',
        borderRadius: '12px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
        zIndex: 9999,
        minWidth: '180px',
        overflow: 'hidden',
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <PopoverMenuItem label="Move left" onClick={onClose} />
      <PopoverMenuItem label="Move right" onClick={onClose} />
      {isOwner && (
        <>
          <PopoverMenuItem label="Organize" onClick={onClose} />
          <PopoverMenuItem label="Rename" onClick={onClose} />
        </>
      )}
      <div style={{ height: '1px', backgroundColor: 'var(--border-default)', margin: '0' }} />
      <PopoverMenuItem label={isOwner ? 'Delete' : 'Remove'} onClick={onClose} />
    </div>,
    document.body
  );
}

// Create Group Modal
interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}

type VisibilityOption = 'private' | 'operations' | 'company';

function CreateGroupModal({ isOpen, onClose, onCreate }: CreateGroupModalProps) {
  const [groupName, setGroupName] = useState('New group');
  const [currentView, setCurrentView] = useState<'main' | 'visibility'>('main');
  const [visibility, setVisibility] = useState<VisibilityOption>('private');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  const visibilityLabels: Record<VisibilityOption, string> = {
    private: 'Private to you',
    operations: 'Anyone in Operations',
    company: 'Anyone at the company',
  };

  const getSubtitleFromVisibility = () => {
    if (visibility === 'private') return 'Private';
    return 'Shared by you';
  };

  const handleCreate = () => {
    onCreate(groupName);
    onClose();
    setGroupName('New group');
    setVisibility('private');
    setCurrentView('main');
  };

  const handleClose = () => {
    onClose();
    setGroupName('New group');
    setVisibility('private');
    setCurrentView('main');
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          width: '720px',
          maxWidth: '90vw',
          maxHeight: '80vh',
          display: 'flex',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Panel - Settings */}
        <div
          style={{
            flex: '0 0 320px',
            padding: '24px',
            borderRight: '1px solid var(--border-default)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {currentView === 'main' ? (
            <>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
                Create a new group
              </h2>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 24px 0' }}>
                Groups are shared with your team. Only you can edit.
              </p>

              {/* Name Input */}
              <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Name
              </label>
              <input
                ref={inputRef}
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                style={{
                  padding: '10px 12px',
                  fontSize: '14px',
                  border: '1px solid #635BFF',
                  borderRadius: '8px',
                  outline: 'none',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  marginBottom: '24px',
                }}
              />

              {/* Settings Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0', borderTop: '1px solid var(--border-default)', borderBottom: '1px solid var(--border-default)' }}>
                {/* Owners Row */}
                <button
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 0',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border-default)',
                  }}
                >
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Owners (who can edit)</span>
                  <span style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    You
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M4.5 3L7.5 6L4.5 9" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                </button>

                {/* Visibility Row */}
                <button
                  onClick={() => setCurrentView('visibility')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 0',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Visibility</span>
                  <span style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {visibilityLabels[visibility]}
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M4.5 3L7.5 6L4.5 9" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                </button>
              </div>

              {/* Spacer */}
              <div style={{ flex: 1, minHeight: '16px' }} />

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button
                  onClick={handleClose}
                  style={{
                    flex: 1,
                    padding: '12px 24px',
                    fontSize: '14px',
                    fontWeight: 500,
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    color: 'var(--text-primary)',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  style={{
                    flex: 1,
                    padding: '12px 24px',
                    fontSize: '14px',
                    fontWeight: 500,
                    backgroundColor: '#635BFF',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    color: 'white',
                  }}
                >
                  Create
                </button>
              </div>
            </>
          ) : (
            /* Visibility Drill-down */
            <>
              <button
                onClick={() => setCurrentView('main')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0',
                  marginBottom: '24px',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M7.5 9L4.5 6L7.5 3" stroke="var(--text-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)' }}>Visibility</span>
              </button>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(['private', 'operations', 'company'] as VisibilityOption[]).map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      setVisibility(option);
                      setCurrentView('main');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '16px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        border: visibility === option ? '6px solid #635BFF' : '2px solid var(--border-default)',
                        backgroundColor: 'var(--bg-primary)',
                      }}
                    />
                    <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                      {visibilityLabels[option]}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right Panel - Preview */}
        <div
          style={{
            flex: 1,
            padding: '24px',
            backgroundColor: 'var(--bg-surface)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '24px',
            }}
          >
            <span
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--text-muted)',
                backgroundColor: 'var(--bg-primary)',
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-default)',
              }}
            >
              Preview
            </span>
          </div>

          {/* Preview Toggle Cards */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            {/* Active Preview Card */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'var(--bg-primary)',
                border: '2px solid #635BFF',
                borderRadius: '12px',
                padding: '12px 16px',
                minWidth: '140px',
              }}
            >
              <span style={{ fontSize: '16px', fontWeight: 600, color: '#635BFF', marginBottom: '4px' }}>
                {groupName || 'New group'}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                {getSubtitleFromVisibility()}
              </span>
            </div>

            {/* Placeholder Cards */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-default)',
                borderRadius: '12px',
                padding: '13px 17px',
                minWidth: '100px',
              }}
            >
              <div style={{ width: '80px', height: '14px', backgroundColor: 'var(--border-default)', borderRadius: '4px', marginBottom: '8px' }} />
              <div style={{ width: '50px', height: '10px', backgroundColor: 'var(--border-default)', borderRadius: '4px' }} />
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-default)',
                borderRadius: '12px',
                padding: '13px 17px',
                minWidth: '80px',
              }}
            >
              <div style={{ width: '60px', height: '14px', backgroundColor: 'var(--border-default)', borderRadius: '4px', marginBottom: '8px' }} />
              <div style={{ width: '40px', height: '10px', backgroundColor: 'var(--border-default)', borderRadius: '4px' }} />
            </div>
          </div>

          {/* Placeholder Content Area */}
          <div
            style={{
              flex: 1,
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-default)',
              borderRadius: '12px',
              minHeight: '120px',
            }}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

// Explore/Add to Group Modal
interface ExploreModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupName: string;
}

type ExploreCategory = 'created-by-me' | 'created-by-others' | 'created-by-stripe';
type StripeSubCategory = 'recommended' | 'revenue' | 'customers' | 'payments' | 'authentication' | 'saas' | 'products' | 'balances' | 'fraud' | 'support';

const STRIPE_SUBCATEGORIES: { id: StripeSubCategory; label: string; icon: React.ReactNode }[] = [
  { id: 'recommended', label: 'Recommended', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2L9.5 6H14L10.5 9L12 14L8 11L4 14L5.5 9L2 6H6.5L8 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg> },
  { id: 'revenue', label: 'Revenue', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 12L6 8L10 10L14 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { id: 'customers', label: 'Customers', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/><circle cx="11" cy="6" r="2" stroke="currentColor" strokeWidth="1.5"/><path d="M1 14C1 11.5 3.5 10 6 10C7 10 8 10.2 8.8 10.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M9 14C9 12 10 11 11 11C12.5 11 14 12 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  { id: 'payments', label: 'Payments', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="4" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.5"/><path d="M2 7H14" stroke="currentColor" strokeWidth="1.5"/></svg> },
  { id: 'authentication', label: 'Authentication', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="3" y="7" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/><path d="M5 7V5C5 3.34 6.34 2 8 2C9.66 2 11 3.34 11 5V7" stroke="currentColor" strokeWidth="1.5"/></svg> },
  { id: 'saas', label: 'SaaS', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg> },
  { id: 'products', label: 'Products', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4L8 2L14 4V8L8 14L2 8V4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg> },
  { id: 'balances', label: 'Balances & money movement', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8H14M5 4H11M5 12H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="3" cy="8" r="1" fill="currentColor"/></svg> },
  { id: 'fraud', label: 'Fraud & risk', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/><path d="M5 5L11 11M11 5L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  { id: 'support', label: 'Customer support', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="4" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.5"/><path d="M2 6L8 10L14 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
];

// Category button with hover states
interface CategoryButtonProps {
  isSelected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function CategoryButton({ isSelected, onClick, children }: CategoryButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 8px',
        width: '100%',
        backgroundColor: isSelected ? 'var(--bg-surface)' : 'transparent',
        border: isHovered 
          ? `1px solid ${isSelected ? '#B6C0CD' : 'var(--border-default)'}` 
          : '1px solid transparent',
        borderRadius: '8px',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'border-color 150ms ease',
      }}
    >
      {children}
    </button>
  );
}

function ExploreModal({ isOpen, onClose, groupName }: ExploreModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ExploreCategory>('created-by-me');
  const [isStripeExpanded, setIsStripeExpanded] = useState(false);
  const [selectedStripeCategory, setSelectedStripeCategory] = useState<StripeSubCategory>('recommended');
  const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(new Set(['trial-conversion']));

  const handleClose = () => {
    onClose();
    setSearchQuery('');
    setSelectedCategory('created-by-me');
    setIsStripeExpanded(false);
  };

  const toggleMetric = (metricId: string) => {
    setSelectedMetrics(prev => {
      const next = new Set(prev);
      if (next.has(metricId)) {
        next.delete(metricId);
      } else {
        next.add(metricId);
      }
      return next;
    });
  };

  const categoryData: { id: ExploreCategory; label: string; count: number; icon: React.ReactNode }[] = [
    { 
      id: 'created-by-me', 
      label: 'Created by me', 
      count: 5,
      icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M2.5 14.4H13.5C13.7209 14.4 13.9 14.2209 13.9 14C13.9 12.1222 12.3778 10.6 10.5 10.6H5.5C3.62223 10.6 2.1 12.1222 2.1 14C2.1 14.2209 2.27909 14.4 2.5 14.4ZM2.5 16H13.5C14.6046 16 15.5 15.1046 15.5 14C15.5 11.2386 13.2614 9 10.5 9H5.5C2.73858 9 0.5 11.2386 0.5 14C0.5 15.1046 1.39543 16 2.5 16Z" fill="currentColor"/><path fillRule="evenodd" clipRule="evenodd" d="M8 6.4C9.32548 6.4 10.4 5.32548 10.4 4C10.4 2.67452 9.32548 1.6 8 1.6C6.67452 1.6 5.6 2.67452 5.6 4C5.6 5.32548 6.67452 6.4 8 6.4ZM8 8C10.2091 8 12 6.20914 12 4C12 1.79086 10.2091 0 8 0C5.79086 0 4 1.79086 4 4C4 6.20914 5.79086 8 8 8Z" fill="currentColor"/></svg>
    },
    { 
      id: 'created-by-others', 
      label: 'Created by others', 
      count: 23,
      icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M8 3.25C8 1.73784 9.22212 0.5 10.75 0.5C12.2779 0.5 13.5 1.73785 13.5 3.25C13.5 4.76215 12.2779 6 10.75 6C9.23787 6 8 4.77792 8 3.25ZM10.75 2C10.0557 2 9.5 2.5611 9.5 3.25C9.5 3.94431 10.0611 4.5 10.75 4.5C11.4443 4.5 12 3.93891 12 3.25C12 2.56109 11.4443 2 10.75 2Z" fill="currentColor"/><path fillRule="evenodd" clipRule="evenodd" d="M5.00002 3.5C3.47211 3.5 2.25 4.73785 2.25 6.25001C2.25 7.77792 3.48787 9 5.00002 9C6.52793 9 7.75 7.76215 7.75 6.25001C7.75 4.7247 6.52535 3.5 5.00002 3.5ZM3.75 6.25001C3.75 5.56111 4.3057 5 5.00002 5C5.6969 5 6.25 5.5531 6.25 6.25001C6.25 6.93891 5.69433 7.5 5.00002 7.5C4.3111 7.5 3.75 6.94431 3.75 6.25001Z" fill="currentColor"/><path fillRule="evenodd" clipRule="evenodd" d="M3.77637 10C1.68645 10 0 11.7033 0 13.7948C0 14.732 0.756757 15.5 1.69944 15.5H8.79066C9.72323 15.5 10.5 14.7421 10.5 13.7948C10.5 11.7033 8.81355 10 6.72363 10H3.77637ZM1.5 13.7948C1.5 12.5231 2.52344 11.5 3.77637 11.5H6.72363C7.97656 11.5 9 12.5231 9 13.7948C9 13.9021 8.90644 14 8.79066 14H1.69944C1.59377 14 1.5 13.9122 1.5 13.7948Z" fill="currentColor"/><path d="M9.25 7C8.83579 7 8.5 7.33579 8.5 7.75C8.5 8.16421 8.83579 8.5 9.25 8.5H12.12C12.6034 8.5 13.2139 8.72676 13.7053 9.16191C14.1859 9.58741 14.5 10.1638 14.5 10.83C14.5 11.1328 14.5159 11.4398 14.4921 11.742C14.3774 11.7494 14.2259 11.75 14 11.75H12C11.5858 11.75 11.25 12.0858 11.25 12.5C11.25 12.9142 11.5858 13.25 12 13.25L14.0255 13.25C14.4935 13.2501 15.0094 13.2701 15.416 12.999C15.9183 12.6642 16 12.0564 16 11.5V10.83C16 9.65725 15.4391 8.69364 14.6997 8.03888C13.9711 7.39377 13.0166 7 12.12 7H9.25Z" fill="currentColor"/></svg>
    },
    { 
      id: 'created-by-stripe', 
      label: 'Created by Stripe', 
      count: 18,
      icon: null, // Will use chevron with rotation
    },
  ];

  // Mock metric data
  const metrics = [
    { id: 'mrr', label: 'Monthly Recurring Revenue', value: '$536.3K', delta: '-1.45%', deltaType: 'negative' as const },
    { id: 'successful-payments', label: 'Successful payments', value: '14,205', delta: '+2.02%', deltaType: 'positive' as const },
    { id: 'trial-conversion', label: 'Trial conversion rate', value: '73.14%', delta: '+0.67%', deltaType: 'positive' as const },
    { id: 'arpu', label: 'Average Revenue Per User', value: '$50', delta: '+10%', deltaType: 'positive' as const },
    { id: 'clv', label: 'Customer Lifetime Value', value: '$602.41', delta: '+0.15%', deltaType: 'positive' as const },
    { id: 'churn-rate', label: 'Churn Rate', value: '2.3%', delta: '-0.5%', deltaType: 'positive' as const },
  ];

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          width: '900px',
          maxWidth: '90vw',
          height: '720px',
          maxHeight: '85vh',
          display: 'flex',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Panel - Categories */}
        <div
          style={{
            flex: '0 0 320px',
            padding: '24px',
            borderRight: '1px solid var(--border-default)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
            Add to group
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 24px 0' }}>
            Choose which metrics or report you want to add to "{groupName}".
          </p>

          {/* Search Input */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#f5f6f8',
              borderRadius: '8px',
              padding: '10px 12px',
              marginBottom: '16px',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <path d="M7 12C9.76 12 12 9.76 12 7C12 4.24 9.76 2 7 2C4.24 2 2 4.24 2 7C2 9.76 4.24 12 7 12Z" stroke="var(--text-muted)" strokeWidth="1.5"/>
              <path d="M14 14L10.5 10.5" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              placeholder="Search all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input-transparent"
              style={{
                flex: 1,
                outline: 'none',
                fontSize: '14px',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Category List */}
          <div className="modal-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flex: 1 }}>
            {categoryData.map((cat) => (
              <div key={cat.id}>
                <CategoryButton
                  isSelected={selectedCategory === cat.id && cat.id !== 'created-by-stripe'}
                  onClick={() => {
                    if (cat.id === 'created-by-stripe') {
                      setIsStripeExpanded(!isStripeExpanded);
                      setSelectedCategory(cat.id);
                    } else {
                      setSelectedCategory(cat.id);
                      setIsStripeExpanded(false);
                    }
                  }}
                >
                  {cat.id === 'created-by-stripe' ? (
                    <svg 
                      width="16" 
                      height="16" 
                      viewBox="0 0 16 16" 
                      fill="none"
                      style={{ 
                        color: 'var(--text-secondary)',
                        transform: isStripeExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 200ms ease-in-out',
                      }}
                    >
                      <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <span style={{ color: 'var(--text-secondary)' }}>{cat.icon}</span>
                  )}
                  <span style={{ flex: 1, fontSize: '14px', color: 'var(--text-primary)' }}>{cat.label}</span>
                  <span
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-muted)',
                      backgroundColor: selectedCategory === cat.id && cat.id !== 'created-by-stripe' ? 'var(--bg-primary)' : 'var(--bg-surface)',
                      padding: '2px 8px',
                      borderRadius: '12px',
                    }}
                  >
                    {cat.count}
                  </span>
                </CategoryButton>

                {/* Stripe Subcategories - shown inline when expanded */}
                {cat.id === 'created-by-stripe' && isStripeExpanded && (
                  <div style={{ marginLeft: '28px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {STRIPE_SUBCATEGORIES.map((subcat) => (
                      <CategoryButton
                        key={subcat.id}
                        isSelected={selectedStripeCategory === subcat.id}
                        onClick={() => setSelectedStripeCategory(subcat.id)}
                      >
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {subcat.icon}
                        </span>
                        <span 
                          style={{ 
                            fontSize: '14px', 
                            color: 'var(--text-primary)',
                          }}
                        >
                          {subcat.label}
                        </span>
                      </CategoryButton>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Done Button */}
          <button
            onClick={handleClose}
            style={{
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: 500,
              backgroundColor: '#635BFF',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              color: 'white',
              marginTop: '16px',
            }}
          >
            {selectedMetrics.size === 0 
              ? 'Done' 
              : `Add ${selectedMetrics.size} metric${selectedMetrics.size === 1 ? '' : 's'}`}
          </button>
        </div>

        {/* Right Panel - Metrics Grid */}
        <div
          className="modal-scrollbar"
          style={{
            flex: 1,
            padding: '24px',
            backgroundColor: 'var(--bg-surface)',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '16px',
            }}
          >
            {metrics.map((metric) => (
              <div
                key={metric.id}
                onClick={() => toggleMetric(metric.id)}
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  border: selectedMetrics.has(metric.id) ? '2px solid #635BFF' : '1px solid var(--border-default)',
                  borderRadius: '12px',
                  padding: selectedMetrics.has(metric.id) ? '15px' : '16px',
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{metric.label}</span>
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: selectedMetrics.has(metric.id) ? '#635BFF' : 'transparent',
                      border: selectedMetrics.has(metric.id) ? 'none' : '1px solid var(--border-default)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {selectedMetrics.has(metric.id) && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                </div>

                {/* Value */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>{metric.value}</span>
                  <span style={{ fontSize: '14px', color: metric.deltaType === 'positive' ? 'var(--color-positive)' : 'var(--color-negative)' }}>{metric.delta}</span>
                </div>

                {/* Placeholder Chart */}
                <div style={{ height: '60px', position: 'relative' }}>
                  <svg width="100%" height="100%" viewBox="0 0 200 60" preserveAspectRatio="none">
                    <path
                      d="M0,40 Q20,35 40,38 T80,30 T120,35 T160,25 T200,30"
                      fill="none"
                      stroke="#635BFF"
                      strokeWidth="2"
                    />
                    <line x1="0" y1="30" x2="200" y2="30" stroke="var(--border-default)" strokeWidth="1" strokeDasharray="4,4" />
                  </svg>
                  <div style={{ position: 'absolute', top: 0, right: 0, fontSize: '10px', color: 'var(--text-muted)' }}>$550K</div>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, fontSize: '10px', color: 'var(--text-muted)' }}>Jan</div>
                  <div style={{ position: 'absolute', bottom: 0, right: 0, fontSize: '10px', color: 'var(--text-muted)' }}>Today</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Group toggle card component
interface GroupToggleProps {
  id: string;
  label: string;
  subtitle: string;
  count?: number;
  isActive: boolean;
  isPrivate?: boolean;
  onClick: () => void;
}

function GroupToggle({ id, label, subtitle, count, isActive, isPrivate, onClick }: GroupToggleProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const settingsIconRef = useRef<HTMLSpanElement>(null);

  const isOwner = subtitle.toLowerCase().includes('private') || 
                  subtitle.toLowerCase().includes('by you');

  const handleCardClick = () => {
    if (!isPopoverOpen) {
      onClick();
    }
  };

  return (
    <div
      style={{ position: 'relative', flexShrink: 0 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-primary)',
          border: isActive 
            ? '2px solid #635BFF' 
            : isHovered 
              ? '1px solid #D8DEE4' 
              : '1px solid var(--border-default)',
          borderRadius: '12px',
          padding: isActive ? '12px 16px' : '13px 17px',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'all 200ms ease-in-out',
        }}
      >
        {/* Top row */}
        <div className="flex items-center mb-1" style={{ gap: '16px' }}>
          <span
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: isActive ? '#635BFF' : 'var(--text-primary)',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </span>
          
          <div 
            className="flex items-center"
            style={{ 
              gap: isHovered ? '12px' : '0px',
              transition: 'gap 200ms ease-in-out',
            }}
          >
            {/* Show settings icon when active, otherwise show count/private indicator */}
            {isActive ? (
              <span
                ref={settingsIconRef}
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPopoverOpen(prev => !prev);
                }}
                style={{
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '20px',
                  height: '20px',
                  padding: '4px',
                  margin: '-4px',
                  borderRadius: '4px',
                }}
              >
                <SettingsIcon size={12} />
              </span>
            ) : (
              <>
                {count !== undefined && (
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: 'var(--text-muted)',
                      backgroundColor: 'var(--bg-surface)',
                      borderRadius: '9999px',
                      padding: '0 8px',
                      height: '20px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {count}
                  </span>
                )}
              </>
            )}
            
            {/* Drag handle with transition */}
            <div
              style={{
                width: isHovered ? '16px' : '0px',
                opacity: isHovered ? 1 : 0,
                overflow: 'hidden',
                transition: 'all 200ms ease-in-out',
                flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--text-muted)' }}>
                <circle cx="4" cy="4" r="1" fill="currentColor"/>
                <circle cx="4" cy="8" r="1" fill="currentColor"/>
                <circle cx="4" cy="12" r="1" fill="currentColor"/>
                <circle cx="8" cy="4" r="1" fill="currentColor"/>
                <circle cx="8" cy="8" r="1" fill="currentColor"/>
                <circle cx="8" cy="12" r="1" fill="currentColor"/>
              </svg>
            </div>
          </div>
        </div>
        
        {/* Subtitle */}
        <span
          style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            whiteSpace: 'nowrap',
            fontWeight: 400,
          }}
        >
          {subtitle}
        </span>
      </div>

      {/* Settings Popover */}
      <ToggleSettingsPopover
        isOpen={isPopoverOpen}
        onClose={() => setIsPopoverOpen(false)}
        isOwner={isOwner}
        anchorRef={settingsIconRef}
      />
    </div>
  );
}

// Compact metric toggle component for the sidebar - standalone card style
interface MetricToggleProps {
  label: string;
  sparklineData: number[];
  value?: string;
  delta?: string;
  deltaType?: 'positive' | 'negative';
  isSelected?: boolean;
  onClick?: () => void;
}

function MetricToggle({ label, sparklineData, value, delta, deltaType, isSelected, onClick }: MetricToggleProps) {
  const [isHovered, setIsHovered] = useState(false);
  const chartData = sparklineData.map((v, i) => ({ x: i, y: v }));
  
  return (
    <div
      className="flex items-center px-4 py-3 cursor-pointer transition-colors"
      style={{
        backgroundColor: isSelected || isHovered ? 'var(--bg-surface)' : 'transparent',
        borderRadius: '12px',
        gap: '12px',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Metric name - takes remaining space, truncates */}
      <span 
        style={{ 
          fontSize: '14px', 
          color: 'var(--text-primary)',
          flex: '1 1 0',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      
      {/* Mini sparkline - 44px */}
      <div style={{ width: '44px', height: '20px', flex: '0 0 44px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <Line
              type="monotone"
              dataKey="y"
              stroke="#635BFF"
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {isSelected ? (
        // Open report - 124px to align with value (56) + delta (56) + gap (12)
        <span 
          className="flex items-center justify-end gap-1"
          style={{ 
            fontSize: '14px', 
            color: 'var(--text-primary)',
            flex: '0 0 124px',
          }}
        >
          Open report
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 9.5L9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      ) : (
        <>
          {/* Value - 56px */}
          <span 
            style={{ 
              fontSize: '14px', 
              color: 'var(--text-primary)',
              fontWeight: 500,
              flex: '0 0 56px',
              textAlign: 'right',
            }}
          >
            {value}
          </span>
          {/* Delta - 56px */}
          <span 
            style={{ 
              fontSize: '14px', 
              color: deltaType === 'positive' ? 'var(--color-positive)' : 'var(--color-negative)',
              flex: '0 0 56px',
              textAlign: 'right',
            }}
          >
            {delta}
          </span>
        </>
      )}
    </div>
  );
}

// Starred metric toggle - computes values from preset data
interface StarredMetricToggleProps {
  presetKey: PresetKey;
  label: string;
  isSelected?: boolean;
  onClick?: () => void;
}

function StarredMetricToggle({ presetKey, label, isSelected, onClick }: StarredMetricToggleProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { store: warehouse } = useWarehouseStore();
  const router = useRouter();
  
  const preset = PRESET_CONFIGS[presetKey];
  
  // Handle click - if selected, navigate to report; otherwise select the toggle
  const handleClick = () => {
    if (isSelected) {
      // Navigate to report detail page
      const slug = toSlug(label);
      router.push(`/${slug}?from=analytics`);
    } else {
      // Select this toggle
      onClick?.();
    }
  };
  
  // Compute metric data for this preset
  const { sparklineData, formattedValue, formattedDelta, isNegative } = useMemo(() => {
    if (!warehouse || Object.keys(warehouse).length === 0) {
      return { sparklineData: [], formattedValue: '-', formattedDelta: '-', isNegative: false };
    }

    // Check if required data is loaded
    const requiredObjects = preset.objects;
    const hasRequiredData = requiredObjects.some(obj => {
      const data = warehouse[obj as keyof typeof warehouse];
      return data && Array.isArray(data) && data.length > 0;
    });

    if (!hasRequiredData) {
      return { sparklineData: [], formattedValue: '-', formattedDelta: '-', isNegative: false };
    }

    try {
      // Build a temporary formula from the preset config (same pattern as ReportWidget)
      const blocks = preset.multiBlock?.blocks || [{
        id: 'main',
        name: preset.metric.name,
        source: preset.metric.source,
        op: preset.metric.op,
        type: preset.metric.type,
        filters: preset.filters || [],
      }];

      const formula = {
        name: preset.label,
        blocks,
        calculation: preset.multiBlock?.calculation || null,
        outputUnit: preset.multiBlock?.outputUnit || (preset.metric.op === 'count' || preset.metric.op === 'distinct_count' ? 'count' : 'volume'),
      };

      const range = preset.range || {
        start: `${new Date().getFullYear()}-01-01`,
        end: new Date().toISOString().slice(0, 10),
        granularity: 'week' as const,
      };

      const { result } = computeFormula({
        formula: formula as any,
        start: range.start,
        end: range.end,
        granularity: range.granularity,
        store: warehouse,
        schema: schema,
        selectedObjects: preset.objects,
        selectedFields: preset.fields,
      });

      const series = result.series || [];
      if (series.length === 0) {
        return { sparklineData: [], formattedValue: '-', formattedDelta: '-', isNegative: false };
      }

      // Use result.value which is the properly computed headline value based on metric type
      const current = result.value ?? 0;

      // Calculate sparkline data (just the values)
      const sparkData = series.map(d => d.value);

      // Calculate comparison
      let pctChange: number | null = null;
      let negative = false;

      if (series.length >= 2) {
        const isStockMetric = preset.metric.type === 'latest' || preset.metric.type === 'first';
        
        if (isStockMetric) {
          const firstValue = series[0].value;
          const lastValue = series[series.length - 1].value;
          if (firstValue !== 0) {
            pctChange = ((lastValue - firstValue) / Math.abs(firstValue)) * 100;
            negative = pctChange < 0;
          }
        } else {
          const midpoint = Math.floor(series.length / 2);
          const firstHalfSum = series.slice(0, midpoint).reduce((sum, d) => sum + d.value, 0);
          const secondHalfSum = series.slice(midpoint).reduce((sum, d) => sum + d.value, 0);
          
          if (firstHalfSum !== 0) {
            pctChange = ((secondHalfSum - firstHalfSum) / Math.abs(firstHalfSum)) * 100;
            negative = pctChange < 0;
          }
        }
      }

      // Format value based on metric type - use compact formatting for toggles
      const isCount = preset.metric.op === 'count' || preset.metric.op === 'distinct_count';
      const fmtValue = isCount ? formatNumber(current, { compact: true }) : currency(current, { compact: true });
      const fmtDelta = pctChange !== null 
        ? `${negative ? '' : '+'}${pctChange.toFixed(0)}%` 
        : '-';

      return {
        sparklineData: sparkData,
        formattedValue: fmtValue,
        formattedDelta: fmtDelta,
        isNegative: negative,
      };
    } catch (err) {
      console.error(`[StarredMetricToggle] Error computing ${presetKey}:`, err);
      return { sparklineData: [], formattedValue: '-', formattedDelta: '-', isNegative: false };
    }
  }, [warehouse, preset, presetKey]);

  const chartData = sparklineData.map((v, i) => ({ x: i, y: v }));

  // Determine border based on selected/hover state
  const getBorderStyle = () => {
    if (isSelected) {
      // Selected: show border on hover using +/explore button color
      return isHovered ? '1px solid #B6C0CD' : '1px solid transparent';
    } else {
      // Unselected: show border on hover using group toggle color
      return isHovered ? '1px solid #D8DEE4' : '1px solid transparent';
    }
  };

  return (
    <div
      className="flex items-center cursor-pointer"
      style={{
        backgroundColor: isSelected ? 'var(--bg-surface)' : 'transparent',
        borderRadius: '12px',
        gap: '12px',
        border: getBorderStyle(),
        padding: '11px 15px', // Slightly less to account for 1px border
        transition: 'all 200ms ease-in-out',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      {/* Metric name - takes remaining space, truncates */}
      <span 
        style={{ 
          fontSize: '14px', 
          color: 'var(--text-primary)',
          flex: '1 1 0',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      
      {/* Mini sparkline - 44px */}
      <div style={{ width: '44px', height: '20px', flex: '0 0 44px' }}>
        {chartData.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line
                type="monotone"
                dataKey="y"
                stroke="#635BFF"
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {isSelected ? (
        // Open report - 124px to align with value (56) + delta (56) + gap (12)
        <span 
          className="flex items-center justify-end gap-1"
          style={{ 
            fontSize: '14px', 
            color: 'var(--text-primary)',
            flex: '0 0 124px',
          }}
        >
          Open report
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 9.5L9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      ) : (
        <>
          {/* Value - 56px */}
          <span 
            style={{ 
              fontSize: '14px', 
              color: 'var(--text-primary)',
              fontWeight: 500,
              flex: '0 0 56px',
              textAlign: 'right',
            }}
          >
            {formattedValue}
          </span>
          {/* Delta - 56px */}
          <span 
            style={{ 
              fontSize: '14px', 
              color: isNegative ? 'var(--color-negative)' : 'var(--color-positive)',
              flex: '0 0 56px',
              textAlign: 'right',
            }}
          >
            {formattedDelta}
          </span>
        </>
      )}
    </div>
  );
}

/**
 * Analytics page content
 */
// Group toggle data
const GROUP_TOGGLES = [
  { id: 'churn', label: 'Churn', subtitle: 'Private', count: 3 },
  { id: 'subscriber-performance', label: 'New subscriber performance', subtitle: 'Shared by sgresh', count: 6 },
  { id: 'products-breakdown', label: 'Products breakdown', subtitle: 'Shared by sgresh', count: 6 },
  { id: 'scheduled-alerts', label: 'Scheduled alerts', subtitle: 'Shared by you', count: 6 },
  { id: 'revenue-trends', label: 'Revenue trends', subtitle: 'Private', count: 4 },
  { id: 'customer-cohorts', label: 'Customer cohorts', subtitle: 'Shared by team', count: 8 },
];

// Warehouse data sources for the Updated chip popover
const WAREHOUSE_SOURCES = [
  {
    id: 'stripe',
    name: 'Stripe dashboard data',
    updatedAgo: '27 min ago',
    icon: (
      <div style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: '#533AFD', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path fillRule="evenodd" clipRule="evenodd" d="M0 16L16 12.6069V0L0 3.43278V16Z" fill="white"/>
        </svg>
      </div>
    ),
  },
  {
    id: 'snowflake',
    name: 'Snowflake',
    updatedAgo: '2 hours ago',
    icon: (
      <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M16 2L16 30M16 2L10 8M16 2L22 8M16 30L10 24M16 30L22 24M2 16H30M2 16L8 10M2 16L8 22M30 16L24 10M30 16L24 22M5.86 5.86L26.14 26.14M5.86 5.86L5.86 12.14M5.86 5.86L12.14 5.86M26.14 26.14L26.14 19.86M26.14 26.14L19.86 26.14M26.14 5.86L5.86 26.14M26.14 5.86L19.86 5.86M26.14 5.86L26.14 12.14M5.86 26.14L12.14 26.14M5.86 26.14L5.86 19.86" stroke="#29B5E8" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>
    ),
  },
  {
    id: 'quickbooks',
    name: 'Quickbooks',
    updatedAgo: '7 hours ago',
    icon: (
      <div style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#2CA01C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>qb</span>
      </div>
    ),
  },
];

// Comparison options (same as ChartPanel)
const COMPARISON_OPTIONS = [
  { value: 'none', label: 'No comparison' },
  { value: 'previous_period', label: 'Previous period' },
  { value: 'previous_year', label: 'Previous year' },
];

export function AnalyticsPageContent() {
  const { state, dispatch } = useApp();
  const { store: warehouse } = useWarehouseStore();
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [selectedRange, setSelectedRange] = useState('YTD');
  const [activeGroupId, setActiveGroupId] = useState('churn');
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [isExploreModalOpen, setIsExploreModalOpen] = useState(false);
  
  // Updated chip state
  const [isWarehousePopoverOpen, setIsWarehousePopoverOpen] = useState(false);
  const [isWarehouseChipHovered, setIsWarehouseChipHovered] = useState(false);
  const warehouseButtonRef = useRef<HTMLButtonElement>(null);
  const warehousePopoverRef = useRef<HTMLDivElement>(null);
  
  // Compare chip state
  const [isComparePopoverOpen, setIsComparePopoverOpen] = useState(false);
  const compareButtonRef = useRef<HTMLButtonElement>(null);
  const comparePopoverRef = useRef<HTMLDivElement>(null);
  
  // Metric toggle state - tracks which preset is selected for the top section chart
  const [selectedStarredPreset, setSelectedStarredPreset] = useState<PresetKey>('gross_volume');
  
  // Starred section popover state
  const [isStarredPopoverOpen, setIsStarredPopoverOpen] = useState(false);
  const [selectedStarredOption, setSelectedStarredOption] = useState('starred');
  const starredButtonRef = useRef<HTMLButtonElement>(null);
  const starredPopoverRef = useRef<HTMLDivElement>(null);
  
  // Your groups section popover state
  const [isYourGroupsPopoverOpen, setIsYourGroupsPopoverOpen] = useState(false);
  const [yourGroupsFilters, setYourGroupsFilters] = useState({
    yourGroups: true,
    byTeammates: true,
    byCategory: true,
    highlighted: true,
  });
  const yourGroupsButtonRef = useRef<HTMLButtonElement>(null);
  const yourGroupsPopoverRef = useRef<HTMLDivElement>(null);
  
  // Starred toggles scroll state - hide shadow when at bottom
  const [isStarredTogglesAtBottom, setIsStarredTogglesAtBottom] = useState(false);
  
  const isComparisonSelected = state.chart.comparison !== 'none';
  const currentComparisonLabel = state.chart.comparison === 'none' 
    ? 'Compare' 
    : `Compare to ${COMPARISON_OPTIONS.find(opt => opt.value === state.chart.comparison)?.label.toLowerCase() || 'selection'}`;

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

  // Handle click outside for popovers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Warehouse popover
      if (
        warehousePopoverRef.current &&
        !warehousePopoverRef.current.contains(event.target as Node) &&
        warehouseButtonRef.current &&
        !warehouseButtonRef.current.contains(event.target as Node)
      ) {
        setIsWarehousePopoverOpen(false);
      }
      // Compare popover
      if (
        comparePopoverRef.current &&
        !comparePopoverRef.current.contains(event.target as Node) &&
        compareButtonRef.current &&
        !compareButtonRef.current.contains(event.target as Node)
      ) {
        setIsComparePopoverOpen(false);
      }
      // Starred popover
      if (
        starredPopoverRef.current &&
        !starredPopoverRef.current.contains(event.target as Node) &&
        starredButtonRef.current &&
        !starredButtonRef.current.contains(event.target as Node)
      ) {
        setIsStarredPopoverOpen(false);
      }
      // Your groups popover
      if (
        yourGroupsPopoverRef.current &&
        !yourGroupsPopoverRef.current.contains(event.target as Node) &&
        yourGroupsButtonRef.current &&
        !yourGroupsButtonRef.current.contains(event.target as Node)
      ) {
        setIsYourGroupsPopoverOpen(false);
      }
    };

    if (isWarehousePopoverOpen || isComparePopoverOpen || isStarredPopoverOpen || isYourGroupsPopoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isWarehousePopoverOpen, isComparePopoverOpen, isStarredPopoverOpen, isYourGroupsPopoverOpen]);

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
  const NavItem = ({ icon, label, isActive = false, hasChevron = false, onClick, href }: { icon: React.ReactNode; label: string; isActive?: boolean; hasChevron?: boolean; onClick?: () => void; href?: string }) => {
    const [isHovered, setIsHovered] = useState(false);
    
    const content = (
      <>
        <div className="flex items-center gap-3">
          {icon}
          <span>{label}</span>
        </div>
        {hasChevron && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4.5 3L7.5 6L4.5 9" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </>
    );

    const styles = {
      backgroundColor: isHovered ? 'var(--bg-surface)' : 'transparent',
      color: isActive ? 'var(--accent-text)' : 'var(--text-primary)',
      border: 'none',
      cursor: 'pointer',
      fontWeight: isActive ? 500 : 400,
      fontSize: '14px',
      textDecoration: 'none',
    };

    if (href) {
      return (
        <Link
          href={href}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="flex items-center justify-between w-full px-3 py-2 rounded-md transition-colors"
          style={styles}
        >
          {content}
        </Link>
      );
    }
    
    return (
      <button
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="flex items-center justify-between w-full px-3 py-2 rounded-md transition-colors"
        style={styles}
      >
        {content}
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
              isActive={false}
              href="/"
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
            <NavItem
              isActive={true}
              href="/analytics"
              icon={
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 12V8M6 12V4M10 12V6M14 12V2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              }
              label="Analytics"
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
          {/* Analytics Header Section */}
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Analytics</h1>
              <Link
                href="/new"
                className="flex items-center gap-2 text-sm font-semibold transition-colors"
                style={{
                  backgroundColor: 'var(--button-primary-bg)',
                  border: '1px solid var(--button-primary-border)',
                  color: 'var(--button-primary-text)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  textDecoration: 'none',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1V11M1 6H11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Create
              </Link>
            </div>

            {/* Controls row: Updated chip, Date picker, Compare chip */}
            <div className="flex items-center gap-3 mb-6">
              {/* Updated chip */}
              <div className="relative">
                <button
                  ref={warehouseButtonRef}
                  onClick={() => setIsWarehousePopoverOpen(!isWarehousePopoverOpen)}
                  onMouseEnter={() => setIsWarehouseChipHovered(true)}
                  onMouseLeave={() => setIsWarehouseChipHovered(false)}
                  className="text-sm border-none focus:outline-none cursor-pointer flex items-center transition-colors"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    fontWeight: 400,
                    borderRadius: '50px',
                    padding: '6px 12px',
                    height: '32px',
                    whiteSpace: 'nowrap',
                    gap: '8px',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-active)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                  }}
                >
                  {/* Database icon */}
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <ellipse cx="8" cy="4" rx="5" ry="2" stroke="var(--text-muted)" strokeWidth="1.5"/>
                    <path d="M3 4V8C3 9.10457 5.23858 10 8 10C10.7614 10 13 9.10457 13 8V4" stroke="var(--text-muted)" strokeWidth="1.5"/>
                    <path d="M3 8V12C3 13.1046 5.23858 14 8 14C10.7614 14 13 13.1046 13 12V8" stroke="var(--text-muted)" strokeWidth="1.5"/>
                  </svg>
                  <span>Updated 12 min ago</span>
                  {/* Green dot or chevron */}
                  {isWarehouseChipHovered || isWarehousePopoverOpen ? (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2 3L4 5L6 3" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#22C55E' }} />
                  )}
                </button>

                {/* Warehouse Popover */}
                {isWarehousePopoverOpen && (
                  <div
                    ref={warehousePopoverRef}
                    className="absolute z-50"
                    style={{
                      top: 'calc(100% + 4px)',
                      left: 0,
                      borderRadius: '16px',
                      boxShadow: '0 5px 15px rgba(0, 0, 0, 0.16)',
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-default)',
                      width: '320px',
                      overflow: 'hidden',
                    }}
                  >
                    {WAREHOUSE_SOURCES.map((source) => (
                      <button
                        key={source.id}
                        className="w-full text-left py-3 px-4 transition-colors flex items-center gap-3"
                        style={{ backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        onClick={() => setIsWarehousePopoverOpen(false)}
                      >
                        {source.icon}
                        <div className="flex-1">
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{source.name}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Updated {source.updatedAgo}</div>
                        </div>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#22C55E' }} />
                      </button>
                    ))}
                    {/* Connect another warehouse */}
                    <div style={{ borderTop: '1px solid var(--border-default)' }}>
                      <button
                        className="w-full text-left py-3 px-4 transition-colors flex items-center gap-3"
                        style={{ backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        onClick={() => setIsWarehousePopoverOpen(false)}
                      >
                        <div style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M10 4V16M4 10H16" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        </div>
                        <div className="flex-1">
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>Connect another warehouse</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>AWS, Redshift</div>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Date range picker */}
              <div 
                className="flex items-center gap-1 px-1"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: '50px',
                  height: '32px',
                  width: 'fit-content',
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

              {/* Compare chip */}
              <div className="relative">
                <button
                  ref={compareButtonRef}
                  onClick={() => setIsComparePopoverOpen(!isComparePopoverOpen)}
                  className="text-sm border-none focus:outline-none cursor-pointer flex items-center transition-colors"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    color: isComparisonSelected ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontWeight: 400,
                    borderRadius: '50px',
                    padding: '6px 12px',
                    height: '32px',
                    whiteSpace: 'nowrap',
                    gap: isComparisonSelected ? '4px' : '8px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-active)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                  }}
                >
                  {!isComparisonSelected && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6.5625 3.1875C6.5625 2.87684 6.31066 2.625 6 2.625C5.68934 2.625 5.4375 2.87684 5.4375 3.1875V5.4375H3.1875C2.87684 5.4375 2.625 5.68934 2.625 6C2.625 6.31066 2.87684 6.5625 3.1875 6.5625H5.4375V8.8125C5.4375 9.12316 5.68934 9.375 6 9.375C6.31066 9.375 6.5625 9.12316 6.5625 8.8125V6.5625H8.8125C9.12316 6.5625 9.375 6.31066 9.375 6C9.375 5.68934 9.12316 5.4375 8.8125 5.4375H6.5625V3.1875Z" fill="var(--text-muted)"/>
                      <path fillRule="evenodd" clipRule="evenodd" d="M12 5.99999C12 9.31404 9.31405 12 6 12C2.68595 12 0 9.31404 0 5.99999C0 2.68595 2.68595 0 6 0C9.32231 0 12 2.68595 12 5.99999ZM10.875 5.99999C10.875 8.69272 8.69272 10.875 6 10.875C3.30728 10.875 1.125 8.69272 1.125 5.99999C1.125 3.30727 3.30727 1.125 6 1.125C8.69998 1.125 10.875 3.30626 10.875 5.99999Z" fill="var(--text-muted)"/>
                    </svg>
                  )}
                  <span>{currentComparisonLabel}</span>
                  {isComparisonSelected && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2 3L4 5L6 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>

                {/* Compare Popover */}
                {isComparePopoverOpen && (
                  <div
                    ref={comparePopoverRef}
                    className="absolute py-1 z-50"
                    style={{
                      top: 'calc(100% + 4px)',
                      left: 0,
                      borderRadius: '16px',
                      boxShadow: '0 5px 15px rgba(0, 0, 0, 0.16)',
                      width: isComparisonSelected ? '248px' : 'auto',
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-default)',
                    }}
                  >
                    {/* Current selection label */}
                    {isComparisonSelected && (
                      <div className="py-2 text-sm" style={{ paddingLeft: '16px', paddingRight: '16px', color: 'var(--text-primary)', fontWeight: 400 }}>
                        {currentComparisonLabel}
                      </div>
                    )}
                    
                    {/* Options */}
                    {COMPARISON_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          dispatch(actions.setComparison(option.value as any));
                          setIsComparePopoverOpen(false);
                        }}
                        className="w-full text-left py-2 text-sm transition-colors flex items-center gap-4"
                        style={{
                          paddingLeft: '16px',
                          paddingRight: '16px',
                          color: 'var(--text-primary)',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          backgroundColor: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <span>{option.label}</span>
                        {state.chart.comparison === option.value && (
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="8" cy="8" r="8" fill="var(--text-primary)"/>
                            <path d="M11 5.5L7 10L5 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Starred header with popover */}
            <div className="relative mb-4">
              <button
                ref={starredButtonRef}
                onClick={() => setIsStarredPopoverOpen(!isStarredPopoverOpen)}
                className="flex items-center gap-1 cursor-pointer"
                style={{ background: 'none', border: 'none', padding: 0 }}
              >
                <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {selectedStarredOption === 'starred' ? 'Starred' : 
                   selectedStarredOption === 'recently-viewed' ? 'Recently viewed' :
                   selectedStarredOption === 'recently-modified' ? 'Recently modified' : 'Biggest movers'}
                </span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--text-muted)' }}>
                  <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {/* Starred Popover */}
              {isStarredPopoverOpen && (
                <div
                  ref={starredPopoverRef}
                  className="absolute z-50 py-2"
                  style={{
                    top: 'calc(100% + 4px)',
                    left: 0,
                    borderRadius: '16px',
                    boxShadow: '0 5px 15px rgba(0, 0, 0, 0.16)',
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    minWidth: '200px',
                  }}
                >
                  {[
                    { value: 'starred', label: 'Starred' },
                    { value: 'recently-viewed', label: 'Recently viewed' },
                    { value: 'recently-modified', label: 'Recently modified' },
                    { value: 'biggest-movers', label: 'Biggest movers' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setSelectedStarredOption(option.value);
                        setIsStarredPopoverOpen(false);
                      }}
                      className="w-full text-left py-2 text-sm transition-colors flex items-center justify-between"
                      style={{
                        paddingLeft: '16px',
                        paddingRight: '16px',
                        color: 'var(--text-primary)',
                        fontWeight: 600,
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <span>{option.label}</span>
                      {selectedStarredOption === option.value && (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="8" r="8" fill="var(--text-primary)"/>
                          <path d="M11 5.5L7 10L5 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex" style={{ gap: '32px' }}>
              {/* Selected metric chart - fills the main chart area */}
              <div className="flex-1">
                <ReportWidget
                  key={selectedStarredPreset}
                  presetKey={selectedStarredPreset}
                  label={STARRED_PRESETS.find(p => p.key === selectedStarredPreset)?.label}
                  hidePreviousPeriod
                  from="analytics"
                  disableClick
                  noBorder
                  hideOpenLink
                  showXAxis
                />
              </div>

              {/* Compact Metric Toggles - standalone cards with 8px gap, scrollable with shadow for 5+ items */}
              <div 
                className="flex flex-col overflow-y-auto hide-scrollbar"
                onScroll={(e) => {
                  const target = e.currentTarget;
                  const atBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 10;
                  setIsStarredTogglesAtBottom(atBottom);
                }}
                style={{
                  width: '350px',
                  gap: '8px',
                  maxHeight: STARRED_PRESETS.length > 5 ? '240px' : 'none',
                  maskImage: STARRED_PRESETS.length > 5 && !isStarredTogglesAtBottom ? 'linear-gradient(to bottom, black calc(100% - 40px), transparent 100%)' : 'none',
                  WebkitMaskImage: STARRED_PRESETS.length > 5 && !isStarredTogglesAtBottom ? 'linear-gradient(to bottom, black calc(100% - 40px), transparent 100%)' : 'none',
                }}
              >
                {STARRED_PRESETS.map((preset) => (
                  <StarredMetricToggle
                    key={preset.key}
                    presetKey={preset.key}
                    label={preset.label}
                    isSelected={selectedStarredPreset === preset.key}
                    onClick={() => setSelectedStarredPreset(preset.key)}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* Your Groups Section */}
          <section>
            {/* Header with dropdown */}
            <div className="relative mb-4">
              <button
                ref={yourGroupsButtonRef}
                onClick={() => setIsYourGroupsPopoverOpen(!isYourGroupsPopoverOpen)}
                className="flex items-center gap-1 cursor-pointer"
                style={{ background: 'none', border: 'none', padding: 0 }}
              >
                <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>Your groups</span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--text-muted)' }}>
                  <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {/* Your Groups Popover */}
              {isYourGroupsPopoverOpen && (
                <div
                  ref={yourGroupsPopoverRef}
                  className="absolute z-50"
                  style={{
                    top: 'calc(100% + 4px)',
                    left: 0,
                    borderRadius: '16px',
                    boxShadow: '0 5px 15px rgba(0, 0, 0, 0.16)',
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    padding: '16px',
                    minWidth: '320px',
                  }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
                    Choose which groups to display
                  </div>
                  
                  {[
                    { key: 'yourGroups', label: 'Your groups', description: 'Groups you have created' },
                    { key: 'byTeammates', label: 'By teammates', description: 'You added from shared groups' },
                    { key: 'byCategory', label: 'By category', description: 'Created by Stripe for key business areas' },
                    { key: 'highlighted', label: 'Highlighted', description: 'Created by Stripe for important trends' },
                  ].map((option) => (
                    <button
                      key={option.key}
                      onClick={() => {
                        setYourGroupsFilters(prev => ({
                          ...prev,
                          [option.key]: !prev[option.key as keyof typeof prev]
                        }));
                      }}
                      className="w-full text-left py-3 transition-colors flex items-start gap-3"
                      style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {/* Checkbox */}
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '6px',
                          backgroundColor: yourGroupsFilters[option.key as keyof typeof yourGroupsFilters] ? '#635BFF' : 'transparent',
                          border: yourGroupsFilters[option.key as keyof typeof yourGroupsFilters] ? 'none' : '2px solid var(--border-medium)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {yourGroupsFilters[option.key as keyof typeof yourGroupsFilters] && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M10 3L4.5 9L2 6.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{option.label}</div>
                        <div style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>{option.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Toggle bar container */}
            <div 
              className="flex items-center gap-3 mb-6"
              style={{ position: 'relative' }}
            >
              {/* Scrollable toggles container */}
              <div 
                className="flex items-center gap-3 overflow-x-auto hide-scrollbar"
                style={{
                  flex: 1,
                  paddingBottom: '4px',
                  maskImage: 'linear-gradient(to right, black calc(100% - 100px), transparent 100%)',
                  WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 100px), transparent 100%)',
                }}
              >
                {GROUP_TOGGLES.map((group) => (
                  <GroupToggle
                    key={group.id}
                    id={group.id}
                    label={group.label}
                    subtitle={group.subtitle}
                    count={group.count}
                    isPrivate={group.isPrivate}
                    isActive={activeGroupId === group.id}
                    onClick={() => setActiveGroupId(group.id)}
                  />
                ))}
              </div>

              {/* Action buttons - fixed on right, stacked vertically */}
              <div 
                className="flex flex-col"
                style={{
                  flexShrink: 0,
                  paddingLeft: '8px',
                  background: 'linear-gradient(to right, transparent, var(--bg-primary) 20%)',
                  gap: '12px',
                  alignItems: 'flex-end',
                }}
              >
                <ExpandableButton
                  onClick={() => setIsCreateGroupModalOpen(true)}
                  label="New group"
                  icon={
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M8 2V14M2 8H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  }
                />
                <ExpandableButton
                  onClick={() => setIsExploreModalOpen(true)}
                  label="Explore"
                  icon={
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path fillRule="evenodd" clipRule="evenodd" d="M4.66962 1.25C3.64489 1.25 2.7404 1.9194 2.44095 2.8994L0.178845 10.3027C0.0602719 10.6907 0 11.0942 0 11.5C0 13.433 1.567 15 3.5 15C5.433 15 7 13.433 7 11.5V9.39409C7.47031 9.09264 7.78585 9 8 9C8.21415 9 8.52969 9.09264 9 9.39409V11.5C9 13.433 10.567 15 12.5 15C14.433 15 16 13.433 16 11.5C16 11.0942 15.9397 10.6907 15.8212 10.3027L13.559 2.8994C13.2596 1.9194 12.3551 1.25 11.3304 1.25C10.0433 1.25 9 2.29335 9 3.58038V4.16111C8.6829 4.0546 8.34809 4 8.00006 4C7.65198 4 7.31714 4.05462 7 4.16115V3.58038C7 2.29335 5.95665 1.25 4.66962 1.25ZM5.5 8.62734V3.58038C5.5 3.12178 5.12822 2.75 4.66962 2.75C4.30448 2.75 3.98218 2.98853 3.87548 3.33773L2.39667 8.17745C2.74354 8.06233 3.11449 8 3.5 8C4.24362 8 4.93308 8.23191 5.5 8.62734ZM1.5 11.5C1.5 12.6046 2.39543 13.5 3.5 13.5C4.60457 13.5 5.5 12.6046 5.5 11.5C5.5 10.3954 4.60457 9.5 3.5 9.5C2.39543 9.5 1.5 10.3954 1.5 11.5ZM12.5 13.5C11.3954 13.5 10.5 12.6046 10.5 11.5C10.5 10.3954 11.3954 9.5 12.5 9.5C13.6046 9.5 14.5 10.3954 14.5 11.5C14.5 12.6046 13.6046 13.5 12.5 13.5ZM12.5 8C12.8855 8 13.2565 8.06233 13.6033 8.17745L12.1245 3.33773C12.0178 2.98853 11.6955 2.75 11.3304 2.75C10.8718 2.75 10.5 3.12178 10.5 3.58038V8.62734C11.0669 8.23191 11.7564 8 12.5 8ZM7 5.83833V7.70619C7.33093 7.57501 7.66389 7.5 8 7.5C8.33611 7.5 8.66907 7.57501 9 7.70619V5.83824C8.69181 5.60555 8.35795 5.5 8.00006 5.5C7.64212 5.5 7.30822 5.60558 7 5.83833Z" fill="currentColor"/>
                    </svg>
                  }
                />
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
                  from="analytics"
                  group={activeGroupId}
                />
              ))}
            </div>
          </section>
        </main>
      </div>

      {/* Floating Dev Tools */}
      <DevToolsMenu loadingProgress={loadingProgress} showNewButton={true} />

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={isCreateGroupModalOpen}
        onClose={() => setIsCreateGroupModalOpen(false)}
        onCreate={(name) => {
          console.log('Creating group:', name);
          // TODO: Add the new group to GROUP_TOGGLES
        }}
      />

      {/* Explore Modal */}
      <ExploreModal
        isOpen={isExploreModalOpen}
        onClose={() => setIsExploreModalOpen(false)}
        groupName={GROUP_TOGGLES.find(g => g.id === activeGroupId)?.label || 'Group'}
      />
    </div>
  );
}

