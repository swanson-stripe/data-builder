/**
 * Stable Warehouse Store
 * Uses stable refs to prevent unnecessary re-renders
 * Only increments version ticker when data actually changes
 */

'use client';

import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { perf } from '@/lib/instrument';
import { PRESET_CONFIGS, type PresetKey } from '@/lib/presets';

export type EntityName =
  | 'customer'
  | 'customers'
  | 'payment'
  | 'payments'
  | 'refund'
  | 'refunds'
  | 'subscription'
  | 'subscriptions'
  | 'invoice'
  | 'invoices'
  | 'price'
  | 'prices'
  | 'product'
  | 'products'
  | 'payment_method'
  | 'payment_methods'
  | 'payout'
  | 'payouts'
  | 'charge'
  | 'charges'
  | 'subscription_item'
  | 'subscription_items'
  | 'invoice_item'
  | 'invoice_items'
  | 'coupon'
  | 'coupons'
  | 'discount'
  | 'discounts'
  | 'quote'
  | 'quotes'
  | 'credit_note'
  | 'credit_notes'
  | 'subscription_schedule'
  | 'subscription_schedules'
  | 'plan'
  | 'plans'
  | 'payment_intent'
  | 'payment_intents'
  | 'balance_transaction'
  | 'balance_transactions'
  | 'dispute'
  | 'disputes'
  | 'customer_balance_transaction'
  | 'customer_balance_transactions'
  | 'customer_tax_id'
  | 'customer_tax_ids'
  | 'checkout_session'
  | 'checkout_sessions';

type EntityMap = Partial<Record<EntityName, any[]>>;

interface WarehouseContextValue {
  store: React.MutableRefObject<EntityMap>;
  version: number; // Ticks when entities change
  loadEntity: (name: EntityName) => Promise<void>;
  has: (name: EntityName) => boolean;
  loadedEntities: Set<EntityName>;
}

const WarehouseContext = createContext<WarehouseContextValue | null>(null);

interface WarehouseProviderProps {
  children: ReactNode;
  initial?: EntityName[];
  presetKey?: PresetKey;
}

/**
 * WarehouseProvider - Stable warehouse store with ref-based storage
 * No more object cloning, only version ticker updates
 */
export const WarehouseProvider: React.FC<WarehouseProviderProps> = ({
  children,
  initial,
  presetKey
}) => {
  const storeRef = useRef<EntityMap>({});
  const [version, setVersion] = useState(0);
  const [loadedEntities, setLoadedEntities] = useState<Set<EntityName>>(new Set());
  const loadingRef = useRef<Set<EntityName>>(new Set()); // Track in-progress loads

  // Determine initial entities based on preset or fallback
  const getInitialEntities = (): EntityName[] => {
    if (initial) return initial;
    if (presetKey && PRESET_CONFIGS[presetKey]) {
      // Map preset objects to entity names (use singular form - matches generated JSON files)
      return PRESET_CONFIGS[presetKey].objects.map(obj => {
        // The generated JSON files use singular names (customer.json, subscription_item.json, etc.)
        // Return the object name as-is since that's what files are named
        return obj as EntityName;
      });
    }
    return ['customer', 'payment', 'subscription'];
  };

  /**
   * Load a single entity from JSON file
   * Uses stable ref - mutates in place instead of cloning
   */
  const loadEntity = async (name: EntityName): Promise<void> => {
    console.log('[Warehouse] loadEntity called for:', name);

    // Skip if already loaded
    if (storeRef.current[name]) {
      console.log('[Warehouse] Skipping - already loaded:', name);
      return;
    }

    // Skip if already loading
    if (loadingRef.current.has(name)) {
      console.log('[Warehouse] Skipping - already loading:', name);
      return;
    }

    loadingRef.current.add(name);

    try {
      console.log('[Warehouse] Fetching:', `/data/${name}.json`);
      const res = await fetch(`/data/${name}.json`);
      if (!res.ok) {
        throw new Error(`Failed to load ${name}: ${res.statusText}`);
      }
      const json = await res.json();

      console.log(`[Warehouse] Fetch successful for ${name}:`, json.length, 'records');

      // Mutate ref directly - STABLE identity!
      storeRef.current[name] = json;

      // Update loaded set
      setLoadedEntities(prev => {
        const newSet = new Set([...prev, name]);
        console.log('[Warehouse] Updated loadedEntities:', Array.from(newSet));
        return newSet;
      });

      // Tick version to notify subscribers
      setVersion(v => v + 1);

      if (process.env.NODE_ENV === 'development') {
        console.log(`[Warehouse] Loaded ${name}: ${json.length} records`);
      }
    } catch (error) {
      console.error(`[Warehouse] Failed to load ${name}:`, error);
    } finally {
      loadingRef.current.delete(name);
    }
  };

  /**
   * Check if entity is loaded
   */
  const has = (name: EntityName): boolean => {
    return !!storeRef.current[name];
  };

  // Initial load on mount
  useEffect(() => {
    console.log('========================================');
    console.log('[Warehouse] ✅ useEffect TRIGGERED');
    console.log('[Warehouse] presetKey:', presetKey);
    console.log('[Warehouse] initial prop:', initial);
    console.log('========================================');
    
    perf.mark('app_start');
    perf.mark('warehouse_init');

    const initialEntities = getInitialEntities();
    console.log('[Warehouse] getInitialEntities() returned:', initialEntities);
    console.log('[Warehouse] initial entities length:', initialEntities.length);

    if (initialEntities.length === 0) {
      console.error('[Warehouse] ⚠️ ERROR: No initial entities to load!');
      return;
    }

    console.log('[Warehouse] 🚀 Starting async load of', initialEntities.length, 'entities:', initialEntities);

    (async () => {
      // Load initial entities in parallel
      console.log('[Warehouse] 📦 About to call Promise.all with:', initialEntities);
      await Promise.all(initialEntities.map(ent => loadEntity(ent)));

      console.log('[Warehouse] ✅ All entities loaded successfully');
      perf.logSince('warehouse_init', 'Initial warehouse load');

      // Background preload remaining entities during idle time
      const scheduleBackgroundLoad = () => {
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(async () => {
            try {
              const manifest = await fetch('/data/manifest.json').then(r => r.json());
              const allEntities: EntityName[] = manifest?.entities || [];

              // Load entities not yet loaded
              for (const ent of allEntities) {
                if (!storeRef.current[ent]) {
                  await loadEntity(ent);
                }
              }
            } catch (error) {
              console.error('[Warehouse] Background load failed:', error);
            }
          }, { timeout: 5000 });
        } else {
          setTimeout(async () => {
            try {
              const manifest = await fetch('/data/manifest.json').then(r => r.json());
              const allEntities: EntityName[] = manifest?.entities || [];

              for (const ent of allEntities) {
                if (!storeRef.current[ent]) {
                  await loadEntity(ent);
                }
              }
            } catch (error) {
              console.error('[Warehouse] Background load failed:', error);
            }
          }, 100);
        }
      };

      scheduleBackgroundLoad();
    })();
  }, [presetKey]); // Re-run if preset changes

  const contextValue: WarehouseContextValue = {
    store: storeRef,
    version,
    loadEntity,
    has,
    loadedEntities,
  };

  // NO blocking loader - render children immediately!
  return (
    <WarehouseContext.Provider value={contextValue}>
      {children}
    </WarehouseContext.Provider>
  );
};

/**
 * Hook to access warehouse context
 */
export function useWarehouse() {
  const ctx = useContext(WarehouseContext);
  if (!ctx) {
    throw new Error('useWarehouse must be used within WarehouseProvider');
  }
  return ctx;
}

/**
 * Hook to access warehouse store with automatic re-render on version changes
 * Returns the stable ref - subscribers must handle version updates
 */
export function useWarehouseStore() {
  const ctx = useWarehouse();
  // Return store ref and version for manual subscription
  return { store: ctx.store.current, version: ctx.version };
}

/**
 * Hook to get a specific entity with automatic re-render when it loads
 */
export function useEntity<T = any>(name: EntityName): T[] | null {
  const ctx = useWarehouse();
  const [, setTrigger] = useState(0);

  // Re-render when version changes
  useEffect(() => {
    setTrigger(t => t + 1);
  }, [ctx.version]);

  return ctx.store.current[name] as T[] || null;
}
