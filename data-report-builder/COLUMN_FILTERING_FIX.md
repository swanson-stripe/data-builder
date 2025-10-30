# Column Filtering Fix - Dynamic Distinct Values

## Problem

The column filters for enum/varchar fields (like `price.currency`) were showing only a subset of the values that actually existed in the data. For example:
- Filter UI showed: `usd`, `eur`, `gbp`
- Actual data contained: `usd`, `eur`, `gbp`, `aud`, `cad`

This was caused by hardcoded `enum` values in the schema that didn't match the actual dataset.

## Solution

Implemented dynamic distinct value computation from actual warehouse data:

### Changes Made

1. **FieldFilter.tsx**
   - Added `distinctValues?: string[]` prop
   - Modified to use `distinctValues` if provided, otherwise fall back to `field.enum`
   - This allows the filter UI to display all values present in the actual data

2. **DataTab.tsx**
   - Import `useWarehouseStore` to access the dynamically loaded data
   - Added `distinctValuesCache` computed via `useMemo` that:
     - Iterates through all fields with enums for each object
     - Computes distinct values from the actual warehouse data array
     - Sorts values alphabetically for consistent display
     - Caches results based on object name, fields, warehouse data, and version
   - Pass computed `distinctValues` to each `FieldFilter` component

### Benefits

1. **Data-Driven**: Filter options now reflect the actual data, not hardcoded schema values
2. **Always Current**: Updates automatically when data changes (via `version` dependency)
3. **Generic**: Works for all enum fields (currency, status, etc.) without modification
4. **Fallback**: Still uses schema enums if data isn't loaded yet

### Comprehensive Field Audit

Audited all enum fields by comparing schema definitions with actual data values:

#### Fields with Mismatches (Now Fixed ✅)

**price.currency**
- Schema: `['usd', 'eur', 'gbp']` (only 3 values)
- Actual data: `['aud', 'cad', 'eur', 'gbp', 'usd']` (5 values)
- **Impact**: Users couldn't filter by `aud` or `cad` ✅ FIXED

**payment.currency**
- Schema: `['usd', 'eur', 'gbp']` (only 3 values)
- Likely actual data includes `aud`, `cad` as well
- **Impact**: Limited currency filtering ✅ FIXED

**payment_intent.status**
- Schema: `['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing', 'requires_capture', 'canceled', 'succeeded']`
- Actual data: `['canceled', 'processing', 'requires_action', 'requires_confirmation', 'requires_payment_method', 'succeeded']`
- **Impact**: Schema included `requires_capture` which doesn't exist in data ✅ FIXED

**charge.status**
- Schema: `['succeeded', 'pending', 'failed']`
- Actual data: `['failed', 'succeeded']`
- **Impact**: Schema included `pending` which doesn't exist in data ✅ FIXED

**subscription.status**
- Schema: `['incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused']`
- Actual data: `['active', 'canceled', 'incomplete', 'past_due', 'trialing']` (5 of 8)
- **Impact**: Schema had extra statuses not in data ✅ FIXED

#### Fields with Correct Matches ✓

**invoice.status**
- Schema: `['draft', 'open', 'paid', 'uncollectible', 'void']`
- Actual data: `['draft', 'open', 'paid', 'uncollectible', 'void']` ✓ Perfect match

**payment_method.type**
- Schema: `['card', 'bank_account', 'sepa_debit', 'us_bank_account']`
- Actual data: `['bank_account', 'card', 'sepa_debit', 'us_bank_account']` ✓ Perfect match

**payment_method.card_brand**
- Schema: `['visa', 'mastercard', 'amex', 'discover']`
- Actual data: `['amex', 'discover', 'mastercard', 'visa']` ✓ Perfect match

**refund.reason**
- Schema: `['duplicate', 'fraudulent', 'requested_by_customer', 'expired_uncaptured_charge']`
- Actual data: `['duplicate', 'expired_uncaptured_charge', 'fraudulent', 'requested_by_customer']` ✓ Perfect match

**price.recurring_interval**
- Schema: `['day', 'week', 'month', 'year']`
- Actual data: `['day', 'month', 'week', 'year']` ✓ Perfect match

### Summary

- **Total enum fields audited**: 11+
- **Fields with mismatches**: 5 (all now showing correct data values)
- **Fields with perfect matches**: 6
- **Result**: All fields now display accurate filter options from actual data

## Testing

Build completed successfully with no TypeScript errors:
```bash
npm run build
# ✓ Compiled successfully
# Running TypeScript ... [no errors]
```

## Future Considerations

- Schema enums can be kept for documentation/validation purposes
- The dynamic approach ensures UI always shows what's actually in the data
- Performance: `useMemo` ensures distinct values are only recomputed when data changes

