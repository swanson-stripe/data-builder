/**
 * Session persistence utilities for Map View
 * Stores map state and view preference in sessionStorage
 */

import { MapViewState } from '@/state/mapView';

const SESSION_PREFIX = 'map-view-';
const VIEW_PREFIX = 'active-view-';

/**
 * Save map state to session storage
 */
export function saveMapState(reportId: string, state: Partial<MapViewState>): void {
  try {
    const key = `${SESSION_PREFIX}${reportId}`;
    const data = {
      elements: state.elements || [],
      connections: state.connections || [],
      viewport: state.viewport || { zoom: 1, x: 0, y: 0 },
      // Don't persist selectedElementId or panel states
    };
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to save map state:', error);
  }
}

/**
 * Load map state from session storage
 */
export function loadMapState(reportId: string): Partial<MapViewState> | null {
  try {
    const key = `${SESSION_PREFIX}${reportId}`;
    const data = sessionStorage.getItem(key);
    if (!data) return null;
    
    return JSON.parse(data) as Partial<MapViewState>;
  } catch (error) {
    console.warn('Failed to load map state:', error);
    return null;
  }
}

/**
 * Clear map state from session storage
 */
export function clearMapState(reportId: string): void {
  try {
    const key = `${SESSION_PREFIX}${reportId}`;
    sessionStorage.removeItem(key);
  } catch (error) {
    console.warn('Failed to clear map state:', error);
  }
}

/**
 * Save active view preference (table or map)
 */
export function setActiveView(reportId: string, view: 'table' | 'map'): void {
  try {
    const key = `${VIEW_PREFIX}${reportId}`;
    sessionStorage.setItem(key, view);
  } catch (error) {
    console.warn('Failed to save active view:', error);
  }
}

/**
 * Get active view preference
 */
export function getActiveView(reportId: string): 'table' | 'map' | null {
  try {
    const key = `${VIEW_PREFIX}${reportId}`;
    const view = sessionStorage.getItem(key);
    return view as 'table' | 'map' | null;
  } catch (error) {
    console.warn('Failed to get active view:', error);
    return null;
  }
}

/**
 * Clear active view preference
 */
export function clearActiveView(reportId: string): void {
  try {
    const key = `${VIEW_PREFIX}${reportId}`;
    sessionStorage.removeItem(key);
  } catch (error) {
    console.warn('Failed to clear active view:', error);
  }
}

