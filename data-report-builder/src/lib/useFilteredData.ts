/**
 * useFilteredData - Single Source of Truth for Filtered Data
 *
 * This hook provides a unified data source for DataList, MetricHeader, ChartPanel, and ValueTable.
 * It computes the filtered PK list and resolved rows ONCE, preventing:
 * - Multiple redundant computations
 * - Data synchronization issues
 * - Timing/lifecycle problems
 *
 * All components that need the filtered/processed data should use this hook.
 */

'use client';

import { useMemo } from 'react';
import { useApp } from '@/state/app';
import { useWarehouse } from './useWarehouse';
import { useWarehouseIndex } from './warehouseIndex';
import { canonObj } from './canon';
import { pickTimestamp } from './fields';

// Extend Window interface for join pattern warnings
declare global {
  interface Window {
    __warnedJoinPatterns?: Set<string>;
  }
}

export type FilteredDataResult = {
  pkList: { object: string; id: string }[];
  resolvedRows: any[];
  count: number;
};

/**
 * Build filtered PK list and resolve all join values for selected fields
 * This is the single source of truth for all data operations
 */
export function useFilteredData(): FilteredDataResult {
  const { state } = useApp();
  const { store, version } = useWarehouse();
  const idx = useWarehouseIndex();

  // Check if required entities are loaded
  const entitiesReady = useMemo(() => {
    if (state.selectedObjects.length === 0) return false;

    return state.selectedObjects.every(obj => {
      const canonicalObj = canonObj(obj);
      const table = (store.current as any)[canonicalObj];
      return table && Array.isArray(table) && table.length > 0;
    });
  }, [state.selectedObjects, version]);

  // Build PK list (lightweight - just IDs, no materialized rows)
  const pkList = useMemo(() => {
    if (state.selectedObjects.length === 0 || !entitiesReady) {
      return [];
    }

    console.log('[useFilteredData] Building pkList. selectedObjects:', state.selectedObjects);

    const pks: { object: string; id: string }[] = [];

    // Only build PK list from primary entity (first selected object)
    for (const object of state.selectedObjects) {
      const canonicalObj = canonObj(object);
      const table = (store.current as any)[canonicalObj];

      console.log('[useFilteredData] Looking for table:', canonicalObj, 'found:', !!table, 'isArray:', Array.isArray(table), 'length:', table?.length);

      if (!table || !Array.isArray(table)) {
        continue;
      }

      // Just collect PKs - don't materialize rows yet!
      for (const record of table) {
        pks.push({ object: canonicalObj, id: record.id });
      }
    }

    const sample = pks.slice(0, 3);
    console.log('[useFilteredData] Built pkList with', pks.length, 'items. Sample:', sample);

    return pks;
  }, [store, version, state.selectedObjects, entitiesReady]);

  // Build resolved rows with join values
  // This is where we materialize the data with all joins resolved
  const resolvedRows = useMemo(() => {
    if (pkList.length === 0) {
      return [];
    }

    console.log('[useFilteredData] Resolving rows for', pkList.length, 'PKs with', state.selectedFields.length, 'fields');

    const rows: any[] = [];

    for (const pk of pkList) {
      const pkKey = `${pk.object}:${pk.id}`;
      const baseRow = idx.recordsByPk.get(pkKey);

      if (!baseRow) {
        console.warn('[useFilteredData] Missing base row for PK:', pkKey);
        continue;
      }

      // Start with the base row (includes id, timestamps, etc.)
      const resolved: any = { ...baseRow };

      // ALWAYS include timestamp for filtering
      // Extract timestamp from base row using pickTimestamp
      const timestamp = pickTimestamp(pk.object, baseRow);
      if (timestamp) {
        resolved._timestamp = timestamp;
      }

      // For each selected field, resolve it (either direct or joined)
      for (const field of state.selectedFields) {
        const fieldObject = canonObj(field.object);
        const qualifiedName = `${field.object}.${field.field}`;

        if (fieldObject === pk.object) {
          // Direct field - already in baseRow
          resolved[qualifiedName] = baseRow[field.field];
        } else {
          // Joined field - need to resolve
          const joinedValue = resolveJoinValue(pk, field.object, field.field, idx);
          resolved[qualifiedName] = joinedValue;
        }
      }

      rows.push(resolved);
    }

    console.log('[useFilteredData] Resolved', rows.length, 'rows. First row keys:', Object.keys(rows[0] || {}));
    if (rows.length > 0) {
      console.log('[useFilteredData] First row sample:', rows[0]);
      console.log('[useFilteredData] First row _timestamp:', rows[0]._timestamp);
    }

    return rows;
  }, [pkList, state.selectedFields, idx.recordsByPk.size]);

  return {
    pkList,
    resolvedRows,
    count: pkList.length,
  };
}

/**
 * Resolve a joined field value for a given PK
 * Handles common join patterns: subscriptions->prices, subscriptions->customers, etc.
 */
function resolveJoinValue(
  pk: { object: string; id: string },
  joinObject: string,
  joinField: string,
  idx: any
): any {
  const canonicalJoinObject = canonObj(joinObject);
  const pkKey = `${pk.object}:${pk.id}`;
  const baseRow = idx.recordsByPk.get(pkKey);

  if (!baseRow) {
    return null;
  }

  // Subscriptions -> Prices
  if (pk.object === 'subscriptions' && canonicalJoinObject === 'prices') {
    const price = idx.pricesById?.get(baseRow.price_id);
    return price?.[joinField] ?? null;
  }

  // Subscriptions -> Customers
  if (pk.object === 'subscriptions' && canonicalJoinObject === 'customers') {
    const customer = idx.customersById?.get(baseRow.customer_id);
    return customer?.[joinField] ?? null;
  }

  // Payments -> Customers
  if (pk.object === 'payments' && canonicalJoinObject === 'customers') {
    const customer = idx.customersById?.get(baseRow.customer_id);
    return customer?.[joinField] ?? null;
  }

  // Payments -> Products
  if (pk.object === 'payments' && canonicalJoinObject === 'products') {
    const product = idx.productsById?.get(baseRow.product_id);
    return product?.[joinField] ?? null;
  }

  // Payments -> Payment Methods
  if (pk.object === 'payments' && canonicalJoinObject === 'payment_methods') {
    const pm = idx.paymentMethodsById?.get(baseRow.payment_method_id);
    return pm?.[joinField] ?? null;
  }

  // Invoices -> Customers
  if (pk.object === 'invoices' && canonicalJoinObject === 'customers') {
    const customer = idx.customersById?.get(baseRow.customer_id);
    return customer?.[joinField] ?? null;
  }

  // Prices -> Products
  if (pk.object === 'prices' && canonicalJoinObject === 'products') {
    const product = idx.productsById?.get(baseRow.product_id);
    return product?.[joinField] ?? null;
  }

  // Customers -> Subscriptions (one-to-many - NOT SUPPORTED in this simple model)
  // This would require aggregation, not a simple lookup
  if (pk.object === 'customers' && canonicalJoinObject === 'subscriptions') {
    // Can't resolve one-to-many joins directly
    // Would need to return an array or aggregate
    return null;
  }

  // Customers -> Prices (no direct relationship)
  if (pk.object === 'customers' && canonicalJoinObject === 'prices') {
    // No direct foreign key relationship
    return null;
  }

  // Products -> Prices (one-to-many - NOT SUPPORTED)
  if (pk.object === 'products' && canonicalJoinObject === 'prices') {
    return null;
  }

  // Only warn once per join pattern to avoid console spam
  if (!window.__warnedJoinPatterns) {
    window.__warnedJoinPatterns = new Set();
  }
  const patternKey = `${pk.object}->${canonicalJoinObject}`;
  if (!window.__warnedJoinPatterns.has(patternKey)) {
    console.warn('[useFilteredData] Unhandled join pattern:', pk.object, '->', canonicalJoinObject);
    window.__warnedJoinPatterns.add(patternKey);
  }

  return null;
}
