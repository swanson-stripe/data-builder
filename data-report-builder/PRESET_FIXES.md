# Preset Metric Fixes - Data Schema Update

## Issue
After expanding the data schema from 10 to 27 tables, preset reports were showing empty/missing data (dashes in Data Preview). This was caused by outdated table references and missing bridge tables in the preset configurations.

## Root Cause
The presets were using legacy table names and incomplete relationship chains:

1. **MRR Preset**: Missing `subscription_item` bridge table
   - Old: `subscription` → `price` (no direct link)
   - New: `subscription` → `subscription_item` → `price` (proper chain)

2. **Gross Volume Preset**: Using empty legacy `payment` table
   - Old: `payment` (legacy table, no data generated)
   - New: `charge` (actual payment records with full data)

3. **Refund Count Preset**: Linking through empty `payment` table
   - Old: `refund` → `payment`
   - New: `refund` → `charge`

## Changes Made

### 1. MRR Preset (`presets.ts:34-59`)

**Before:**
```typescript
objects: ['subscription', 'customer', 'price']
```

**After:**
```typescript
objects: ['subscription', 'customer', 'subscription_item', 'price']
fields: [
  // ... subscription fields
  { object: 'subscription_item', field: 'id' },
  { object: 'subscription_item', field: 'quantity' },
  // ... price fields
]
```

**Why:** In Stripe's schema, subscriptions link to prices through `subscription_item`. The relationship chain is:
- `subscription` (has many) → `subscription_item` (has one) → `price`

Without the bridge table, the join couldn't resolve `price.*` fields for subscription rows.

### 2. Gross Volume Preset (`presets.ts:61-85`)

**Before:**
```typescript
objects: ['payment', 'customer', 'product']
metric: {
  source: { object: 'payment', field: 'amount' }
}
```

**After:**
```typescript
objects: ['charge', 'customer', 'payment_intent', 'invoice']
fields: [
  { object: 'charge', field: 'id' },
  { object: 'charge', field: 'amount' },
  { object: 'charge', field: 'status' },
  { object: 'payment_intent', field: 'id' },
  { object: 'invoice', field: 'id' },
  { object: 'invoice', field: 'number' },
]
metric: {
  source: { object: 'charge', field: 'amount' }
}
```

**Why:** The `payment` table is a legacy placeholder with no generated data. Real payment data lives in:
- `payment_intent` (2,380 records) → `charge` (2,311 records)

### 3. Refund Count Preset (`presets.ts:112-136`)

**Before:**
```typescript
objects: ['refund', 'payment', 'customer']
fields: [
  { object: 'payment', field: 'id' },
  { object: 'payment', field: 'created' },
]
```

**After:**
```typescript
objects: ['refund', 'charge', 'customer']
fields: [
  { object: 'refund', field: 'id' },
  { object: 'refund', field: 'reason' },
  { object: 'charge', field: 'id' },
  { object: 'charge', field: 'amount' },
  { object: 'charge', field: 'created' },
]
```

**Why:** Refunds link to charges, not the legacy payment table:
- `charge` (has many) → `refund` (via `charge_id`)

## Schema Relationships Reference

From `/src/data/schema.ts` line 405-651:

### Subscription Flow
```
customer
  └─→ subscription (via customer_id)
        └─→ subscription_item (via subscription_id)
              └─→ price (via price_id)
                    └─→ product (via product_id)
```

### Payment Flow
```
customer
  └─→ payment_intent (via customer_id)
        └─→ charge (via payment_intent_id)
              └─→ refund (via charge_id)
              └─→ balance_transaction (via source_id)
              └─→ dispute (via charge_id)
```

### Invoice Flow
```
customer
  └─→ subscription (via customer_id)
        └─→ invoice (via subscription_id)
              └─→ invoice_item (via invoice_id)
              └─→ payment_intent (via invoice_id)
```

## Verification Steps

After these fixes, the Data Preview should correctly display:

1. **MRR**: Shows `price.unit_amount`, `price.currency`, `price.recurring_interval` alongside subscription data
2. **Gross Volume**: Shows `charge.amount`, `charge.status` with customer and invoice context
3. **Refund Count**: Shows `refund.amount`, `refund.reason` with associated charge data

## Testing

```bash
# Restart dev server (if needed)
npm run dev

# In browser at localhost:3000:
1. Select "MRR" preset → verify price fields populate in Data Preview
2. Select "Gross Volume" preset → verify charge amounts appear
3. Select "Refund Count" preset → verify refund data links to charges
```

## Files Modified
- `/src/lib/presets.ts` (lines 34-136)

## Related Schema Tables

**Active Tables (with data):**
- `subscription` (800 records)
- `subscription_item` (1,008 records)
- `price` (49 records)
- `charge` (2,311 records)
- `refund` (110 records)
- `payment_intent` (2,380 records)
- `invoice` (2,689 records)

**Legacy/Empty Tables:**
- `payment` (0 records - legacy placeholder)
- `checkout_session` (0 records - not yet generated)
- `plan` (0 records - deprecated in favor of `price`)

---

**Date:** October 30, 2025  
**Status:** ✅ Fixed - All presets now use correct schema relationships

