/**
 * Warehouse Index Layer - Indexed Joins
 * Uses incremental updates to avoid full rebuilds on every version tick
 * Only updates Maps for entities that actually changed
 */

'use client';

import { useMemo, useRef } from 'react';
import { useWarehouse } from './useWarehouse';

export const useWarehouseIndex = () => {
  const { store, version, loadedEntities } = useWarehouse(); // version ticks when arrays change

  // Track which entities have been indexed (not just loaded)
  const indexedEntitiesRef = useRef<Set<string>>(new Set());

  // Persistent index that we incrementally update
  const indexRef = useRef<any | null>(null);

  return useMemo(() => {
    // Detect which entities need to be indexed
    // An entity needs indexing if: it's loaded AND not yet indexed
    const entitiesToIndex = new Set<string>();

    for (const entity of loadedEntities) {
      if (!indexedEntitiesRef.current.has(entity)) {
        entitiesToIndex.add(entity);
      }
    }

    // Initialize index on first run
    if (!indexRef.current) {
      indexRef.current = {
        customersById: new Map<string, any>(),
        productsById: new Map<string, any>(),
        pricesById: new Map<string, any>(),
        paymentMethodsById: new Map<string, any>(),
        paymentsById: new Map<string, any>(),
        refundsByPaymentId: new Map<string, any[]>(),
        paymentsByCustomerId: new Map<string, any[]>(),
        recordsByPk: new Map<string, any>(),
      };
    }

    const idx = indexRef.current;

    console.log('[warehouseIndex] entitiesToIndex:', Array.from(entitiesToIndex), 'loadedEntities:', Array.from(loadedEntities), 'indexedEntities:', Array.from(indexedEntitiesRef.current));

    // Only index newly loaded entities (incremental update)
    // This prevents full Map rebuilds on every version tick

    // Index customers (if not yet indexed)
    if (entitiesToIndex.has('customers')) {
      const customers = store.current.customers ?? [];
      console.log('[warehouseIndex] Indexing customers:', customers.length);
      for (const c of customers) {
        idx.customersById.set(c.id, c);
        idx.recordsByPk.set(`customers:${c.id}`, c);
      }
      indexedEntitiesRef.current.add('customers');
    }

    // Index products (if not yet indexed)
    if (entitiesToIndex.has('products')) {
      for (const p of store.current.products ?? []) {
        idx.productsById.set(p.id, p);
        idx.recordsByPk.set(`products:${p.id}`, p);
      }
      indexedEntitiesRef.current.add('products');
    }

    // Index prices (if not yet indexed)
    if (entitiesToIndex.has('prices')) {
      for (const pr of store.current.prices ?? []) {
        idx.pricesById.set(pr.id, pr);
        idx.recordsByPk.set(`prices:${pr.id}`, pr);
      }
      indexedEntitiesRef.current.add('prices');
    }

    // Index payment methods (if not yet indexed)
    if (entitiesToIndex.has('payment_methods')) {
      for (const pm of store.current.payment_methods ?? []) {
        idx.paymentMethodsById.set(pm.id, pm);
        idx.recordsByPk.set(`payment_methods:${pm.id}`, pm);
      }
      indexedEntitiesRef.current.add('payment_methods');
    }

    // Index payments (if not yet indexed)
    if (entitiesToIndex.has('payments')) {
      for (const pay of store.current.payments ?? []) {
        idx.paymentsById.set(pay.id, pay);
        idx.recordsByPk.set(`payments:${pay.id}`, pay);

        // By customer_id (one-to-many)
        if (!idx.paymentsByCustomerId.has(pay.customer_id)) {
          idx.paymentsByCustomerId.set(pay.customer_id, []);
        }
        idx.paymentsByCustomerId.get(pay.customer_id)!.push(pay);
      }
      indexedEntitiesRef.current.add('payments');
    }

    // Index refunds (if not yet indexed)
    if (entitiesToIndex.has('refunds')) {
      for (const r of store.current.refunds ?? []) {
        idx.recordsByPk.set(`refunds:${r.id}`, r);

        if (!idx.refundsByPaymentId.has(r.payment_id)) {
          idx.refundsByPaymentId.set(r.payment_id, []);
        }
        idx.refundsByPaymentId.get(r.payment_id)!.push(r);
      }
      indexedEntitiesRef.current.add('refunds');
    }

    // Index remaining entities (if not yet indexed)
    if (entitiesToIndex.has('subscriptions')) {
      for (const s of store.current.subscriptions ?? []) {
        idx.recordsByPk.set(`subscriptions:${s.id}`, s);
      }
      indexedEntitiesRef.current.add('subscriptions');
    }
    if (entitiesToIndex.has('invoices')) {
      for (const i of store.current.invoices ?? []) {
        idx.recordsByPk.set(`invoices:${i.id}`, i);
      }
      indexedEntitiesRef.current.add('invoices');
    }
    if (entitiesToIndex.has('payouts')) {
      for (const po of store.current.payouts ?? []) {
        idx.recordsByPk.set(`payouts:${po.id}`, po);
      }
      indexedEntitiesRef.current.add('payouts');
    }
    if (entitiesToIndex.has('charges')) {
      for (const ch of store.current.charges ?? []) {
        idx.recordsByPk.set(`charges:${ch.id}`, ch);
      }
      indexedEntitiesRef.current.add('charges');
    }

    const sampleKeys = Array.from(idx.recordsByPk.keys()).slice(0, 5);
    console.log('[warehouseIndex] Index complete. recordsByPk size:', idx.recordsByPk.size, 'sample keys:', sampleKeys);

    // Return the same idx object (stable reference)
    // Only the Maps inside have been incrementally updated
    return idx;
  }, [version, loadedEntities]); // Re-run when version changes or new entities load
};
