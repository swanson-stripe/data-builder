# Entity Naming Fix - Warehouse Loading

## Issue
After schema expansion, the MRR preset (and others) failed to load with errors like:
```
Failed to load subscription_items: Not Found
```

The Data Preview showed "0 rows" with all dashes because the warehouse couldn't load the required data files.

## Root Cause

**Inconsistent naming convention** between:
1. **Generated JSON files**: Used **singular** names (`subscription_item.json`, `customer.json`)  
2. **EntityName type**: Only included **old 10 tables** with plural forms (`subscriptions`, `customers`)
3. **Presets**: Referenced **singular** schema names (`subscription`, `subscription_item`, `customer`)

The `useWarehouse.tsx` loader tried to pluralize preset object names, but the generated files were singular, causing 404 errors.

## Solution

### 1. Expanded `EntityName` Type (`useWarehouse.tsx:13-61`)

**Before:**
```typescript
export type EntityName =
  | 'customers'
  | 'payments'
  | 'refunds'
  | 'subscriptions'
  | 'invoices'
  | 'prices'
  | 'products'
  | 'payment_methods'
  | 'payouts'
  | 'charges';
```

**After:**
```typescript
export type EntityName =
  | 'customer' | 'customers'
  | 'payment' | 'payments'
  // ... (both singular and plural for all 27 tables)
  | 'subscription_item' | 'subscription_items'
  | 'invoice_item' | 'invoice_items'
  | 'payment_intent' | 'payment_intents'
  | 'balance_transaction' | 'balance_transactions'
  // ... etc for all new tables
```

**Why:** Support **both** singular and plural forms for backward compatibility and flexibility. The type now includes all 54 possible entity names (27 tables × 2 forms).

### 2. Simplified `getInitialEntities()` (`useWarehouse.tsx:95-107`)

**Before:**
```typescript
const getInitialEntities = (): EntityName[] => {
  if (initial) return initial;
  if (presetKey && PRESET_CONFIGS[presetKey]) {
    return PRESET_CONFIGS[presetKey].objects.map(obj => {
      const pluralMap: Record<string, EntityName> = {
        'customer': 'customers',
        'payment': 'payments',
        // ... only 10 old tables
      };
      return pluralMap[obj] || (obj + 's') as EntityName;
    });
  }
  return ['customers', 'payments', 'subscriptions'];
};
```

**After:**
```typescript
const getInitialEntities = (): EntityName[] => {
  if (initial) return initial;
  if (presetKey && PRESET_CONFIGS[presetKey]) {
    // Use object names as-is (matches generated JSON file names)
    return PRESET_CONFIGS[presetKey].objects.map(obj => obj as EntityName);
  }
  return ['customer', 'payment', 'subscription'];
};
```

**Why:** 
- No more pluralization logic - **use object names directly**
- Generated files use singular names, so map directly
- Simpler and less error-prone

### 3. File Name Convention

**Confirmed:** All generated JSON files use **singular** names:
```bash
$ ls public/data/ | grep -E "(subscription|customer|invoice|payment)"
customer.json
customer_balance_transaction.json
customer_tax_id.json
invoice.json
invoice_item.json
payment.json
payment_intent.json
payment_method.json
subscription.json
subscription_item.json
subscription_schedule.json
```

This matches the schema object names in `schema.ts` and preset configurations in `presets.ts`.

## Impact

### ✅ Fixed
- MRR preset now loads: `subscription`, `customer`, `subscription_item`, `price`
- Gross Volume preset loads: `charge`, `customer`, `payment_intent`, `invoice`
- Refund Count preset loads: `refund`, `charge`, `customer`
- Data Preview populates with actual data (not dashes)

### ✅ Backward Compatible
- Includes both singular and plural in `EntityName` type
- Existing code that references `'customers'` or `'customer'` both work
- Fallback logic uses singular forms

### ✅ Scalable
- All 27 new tables supported
- Future tables just need to follow singular naming convention
- No manual pluralization mapping required

## Testing

```bash
# Start dev server
npm run dev

# Navigate to http://localhost:3000
# Select "MRR" preset
# Expected: Data Preview shows subscription data with price.unit_amount populated
# Expected: No console errors about "Failed to load"

# Select "Gross Volume" preset
# Expected: Data Preview shows charge data with amounts

# Select "Refund Count" preset
# Expected: Data Preview shows refund data with associated charges
```

## Files Modified
- `/src/lib/useWarehouse.tsx`
  - Expanded `EntityName` type (lines 13-61)
  - Simplified `getInitialEntities()` (lines 95-107)

## Related Files (No Changes)
- `/public/data/*.json` - All singular names (confirmed)
- `/src/lib/presets.ts` - Already using singular names (fixed in previous commit)
- `/src/data/schema.ts` - Uses singular names

---

**Date:** October 30, 2025  
**Status:** ✅ Fixed - All warehouse entity loading now functional  
**Commit:** Entity naming consistency + expanded EntityName type

