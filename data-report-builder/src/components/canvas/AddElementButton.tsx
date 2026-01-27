'use client';

import { useState, useRef, useEffect } from 'react';
import { useMapView, mapActions } from '@/state/mapView';
import { useReactFlow } from 'reactflow';
import {
  createDataListElement,
  createChartElement,
  createFilterElement,
  createGroupingElement,
  createMetricElement,
  createSQLQueryElement,
  generateConnectionId,
} from '@/lib/mapElementCreation';
import type { MapElementType } from '@/types/mapElements';

interface AddElementButtonProps {
  parentElementId: string;
  position: 'right' | 'bottom' | 'left';
  onMenuStateChange?: (isOpen: boolean) => void;
  onHoverChange?: (isHovered: boolean, elementId: string) => void;
}

export function AddElementButton({ parentElementId, position, onMenuStateChange, onHoverChange }: AddElementButtonProps) {
  const { state, dispatch } = useMapView();
  const reactFlowInstance = useReactFlow();
  const [showMenu, setShowMenu] = useState(false);
  const [buttonHovered, setButtonHovered] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const parentElement = state.elements.find(el => el.id === parentElementId);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current && 
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowMenu(false);
        onMenuStateChange?.(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const handleAddElement = (type: MapElementType) => {
    if (!parentElement || !buttonRef.current) return;

    let newElement;

    // Prefer menu position when available so new element appears where the popover was
    const menuRect = showMenu && menuRef.current ? menuRef.current.getBoundingClientRect() : null;
    const buttonRect = buttonRef.current.getBoundingClientRect();
    
    // Get the React Flow wrapper element to calculate relative position
    const reactFlowBounds = document.querySelector('.react-flow')?.getBoundingClientRect();
    
    if (!reactFlowBounds) return;
    
    // Calculate position relative to React Flow container
    const relativeX = (menuRect ? menuRect.left : buttonRect.left + buttonRect.width / 2) - reactFlowBounds.left;
    const relativeY = (menuRect ? menuRect.top : buttonRect.top + buttonRect.height / 2) - reactFlowBounds.top;
    
    // Use React Flow's project method to convert screen to canvas coordinates
    const canvasPosition = reactFlowInstance.project({ x: relativeX, y: relativeY });

    // Create the appropriate element type
    switch (type) {
      case 'dataList':
        newElement = createDataListElement(state.elements);
        break;
      case 'chart':
        newElement = createChartElement(state.elements, parentElementId);
        break;
      case 'filter':
        newElement = createFilterElement(state.elements, parentElementId);
        break;
      case 'grouping':
        newElement = createGroupingElement(state.elements, parentElementId);
        break;
      case 'metric':
        newElement = createMetricElement(state.elements, parentElementId);
        break;
      case 'sqlQuery':
        newElement = createSQLQueryElement(state.elements, parentElementId);
        break;
      default:
        return;
    }

    newElement.position = {
      x: canvasPosition.x,
      y: canvasPosition.y,
    };

    // Add the element
    dispatch(mapActions.addElement(newElement));

    // Create connection from parent to new element
    dispatch(mapActions.addConnection({
      id: generateConnectionId(parentElementId, newElement.id),
      source: parentElementId,
      target: newElement.id,
    }));

    setShowMenu(false);
    onMenuStateChange?.(false);
  };

  const buttonSize = 32;

  // Position styles based on edge
  const getAnchorStyle = () => {
    const baseStyle = {
      position: 'absolute' as const,
      width: `${buttonSize}px`,
      height: `${buttonSize}px`,
      zIndex: 1000,
    };

    const gap = 20; // 20px gap from element edge
    const buttonRadius = buttonSize / 2;

    switch (position) {
      case 'right':
        return { ...baseStyle, right: -(buttonRadius + gap), top: '50%', transform: 'translateY(-50%)' };
      case 'bottom':
        return { ...baseStyle, bottom: -(buttonRadius + gap), left: '50%', transform: 'translateX(-50%)' };
      case 'left':
        return { ...baseStyle, left: -(buttonRadius + gap), top: '50%', transform: 'translateY(-50%)' };
      default:
        return baseStyle;
    }
  };

  const getButtonStyle = () => ({
    width: `${buttonSize}px`,
    height: `${buttonSize}px`,
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    border: 'none',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
    transition: 'transform 0.15s ease',
    transform: buttonHovered ? 'scale(1.06)' : 'scale(1)',
  });

  const getMenuStyle = () => {
    const baseStyle = {
      position: 'absolute' as const,
      backgroundColor: 'var(--bg-elevated)',
      border: '1px solid var(--border-default)',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      padding: '8px',
      zIndex: 1001,
      minWidth: '180px',
    };

    const menuOffset = 56; // Distance from button center

    switch (position) {
      case 'right':
        return { ...baseStyle, left: menuOffset, top: '50%', transform: 'translateY(-50%)' };
      case 'bottom':
        return { ...baseStyle, top: menuOffset, left: '50%', transform: 'translateX(-50%)' };
      case 'left':
        return { ...baseStyle, right: menuOffset, top: '50%', transform: 'translateY(-50%)' };
      default:
        return baseStyle;
    }
  };

  const menuItems = [
    { type: 'dataList' as MapElementType, label: 'Data List', icon: '📋' },
    { type: 'chart' as MapElementType, label: 'Chart', icon: '📈' },
    { type: 'filter' as MapElementType, label: 'Filter', icon: '🔍' },
    { type: 'grouping' as MapElementType, label: 'Grouping', icon: '📁' },
    { type: 'metric' as MapElementType, label: 'Metric', icon: '🔢' },
    { type: 'sqlQuery' as MapElementType, label: 'SQL Query', icon: '💻' },
  ];

  return (
    <div
      style={getAnchorStyle()}
      onMouseEnter={() => onHoverChange?.(true, parentElementId)}
      onMouseLeave={() => onHoverChange?.(false, parentElementId)}
    >
      <button
        ref={buttonRef}
        className="nodrag nopan"
        onClick={(e) => {
          e.stopPropagation();
          const nextShowMenu = !showMenu;
          onMenuStateChange?.(nextShowMenu);
          setShowMenu(nextShowMenu);
        }}
        onMouseEnter={() => {
          setButtonHovered(true);
        }}
        onMouseLeave={() => {
          setButtonHovered(false);
        }}
        style={getButtonStyle()}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M8.75 4.25C8.75 3.83579 8.41421 3.5 8 3.5C7.58579 3.5 7.25 3.83579 7.25 4.25V7.25H4.25C3.83579 7.25 3.5 7.58579 3.5 8C3.5 8.41421 3.83579 8.75 4.25 8.75H7.25V11.75C7.25 12.1642 7.58579 12.5 8 12.5C8.41421 12.5 8.75 12.1642 8.75 11.75V8.75H11.75C12.1642 8.75 12.5 8.41421 12.5 8C12.5 7.58579 12.1642 7.25 11.75 7.25H8.75V4.25Z"
            fill="currentColor"
          />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M16 7.99999C16 12.4187 12.4187 16 8 16C3.58127 16 0 12.4187 0 7.99999C0 3.58126 3.58127 0 8 0C12.4297 0 16 3.58126 16 7.99999ZM14.5 7.99999C14.5 11.5903 11.5903 14.5 8 14.5C4.4097 14.5 1.5 11.5903 1.5 7.99999C1.5 4.40969 4.4097 1.5 8 1.5C11.6 1.5 14.5 4.40834 14.5 7.99999Z"
            fill="currentColor"
          />
        </svg>
      </button>

      {showMenu && (
        <div
          ref={menuRef}
          className="nodrag nopan"
          style={getMenuStyle()}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={() => onHoverChange?.(true, parentElementId)}
          onMouseLeave={() => onHoverChange?.(false, parentElementId)}
        >
          {menuItems.map((item) => (
            <button
              key={item.type}
              onClick={() => handleAddElement(item.type)}
              style={{
                width: '100%',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                color: 'var(--text-primary)',
                textAlign: 'left',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <span style={{ fontSize: '18px' }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

