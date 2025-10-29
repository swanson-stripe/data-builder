# Prompt C Implementation: Unified RowView Structure

## ✅ Implementation Complete

### Goal Achieved
Created a **unified RowView structure** that transforms normalized warehouse data into a consistent format for UI components (DataList, sorting, filtering, charts).

---

## 📁 Files Created

### 1. **src/lib/views.ts** (NEW)
Complete view transformation library with:

**Core Type:**
```typescript
export type RowView = {
  display: Record<string, string | number | boolean | null>;  // Qualified keys
  pk: { object: string; id: string };                         // Primary key
  ts: string | null;                                           // Canonical timestamp
};
```

**Key Functions:**
```typescript
// Transform warehouse data to RowView[]
buildDataListView(opts: {
  store: Warehouse;
  selectedObjects: string[];
  selectedFields: { object: string; field: string }[];
}): RowView[]

// Filter by date range
filterRowsByDate(rows: RowView[], start: string, end: string): RowView[]

// Get rowKey for selection/filtering
getRowKey(row: RowView): string

// Sort by qualified field
sortRowsByField(rows: RowView[], qualifiedField: string, direction: 'asc' | 'desc'): RowView[]

// Convert back to unqualified for metrics
toUnqualifiedRecord(row: RowView, object: string): Record<string, any>
```

### 2. **src/lib/__tests__/views.test.ts** (NEW)
Comprehensive test suite covering:
- ✅ buildDataListView with multiple scenarios
- ✅ filterRowsByDate with edge cases
- ✅ getRowKey generation
- ✅ sortRowsByField with numbers, strings, nulls
- ✅ toUnqualifiedRecord conversion

---

## 🎯 Acceptance Criteria

| Criteria | Status | Evidence |
|----------|--------|----------|
| buildDataListView produces qualified keys | ✅ PASS | Always uses qualify() function |
| Each row has pk (object, id) | ✅ PASS | RowView type enforces structure |
| Each row has ts (timestamp) | ✅ PASS | Uses pickTimestamp() from fields.ts |
| DataList can use unified shape | ✅ PASS | Compatible with existing DataList |
| Charts can use unified shape | ✅ PASS | toUnqualifiedRecord() for metrics |
| Filters can use unified shape | ✅ PASS | filterRowsByDate() provided |
| Server compiles without errors | ✅ PASS | ✓ Compiled successfully |

---

## 📊 RowView Structure Explained

### The Unified Shape

```typescript
{
  display: {
    "payment.id": "pi_001",           // Qualified for UI
    "payment.amount": 29900,          // Qualified for UI
    "payment.created": "2025-03-15"   // Qualified for UI
  },
  pk: {
    object: "payment",                 // Object type
    id: "pi_001"                       // Record ID
  },
  ts: "2025-03-15"                     // Canonical timestamp
}
```

### Why This Structure?

**1. `display` - Qualified Keys**
- ✅ Always qualified (e.g., "payment.amount")
- ✅ No ambiguity in multi-object views
- ✅ Ready for UI rendering
- ✅ Consistent across all components

**2. `pk` - Primary Key**
- ✅ Unique identifier { object, id }
- ✅ Enables rowKey generation: "payment:pi_001"
- ✅ Supports joins and relationships
- ✅ Type-safe access

**3. `ts` - Canonical Timestamp**
- ✅ Automatically picked using pickTimestamp()
- ✅ Priority-based selection (e.g., subscription uses current_period_start)
- ✅ Enables date filtering
- ✅ Supports chart bucketing

---

## 🔄 Data Flow

```
┌──────────────────────────────────────────┐
│ warehouse (normalized)                   │
│ - customers: Customer[]                  │
│ - payments: Payment[]                    │
│ - subscriptions: Subscription[]          │
│ { id: "pi_001", amount: 29900, ... }    │
└──────────────────────────────────────────┘
              ▼
       buildDataListView()
              ▼
┌──────────────────────────────────────────┐
│ RowView[] (qualified)                    │
│ {                                        │
│   display: {                             │
│     "payment.id": "pi_001",              │
│     "payment.amount": 29900              │
│   },                                     │
│   pk: { object: "payment", id: "pi_001" │
│   ts: "2025-03-15"                       │
│ }                                        │
└──────────────────────────────────────────┘
              ▼
    ┌─────────┴─────────┐
    ▼                   ▼
┌────────┐      ┌───────────────┐
│ DataList│      │ Filters/Charts│
│ (display)│      │ (pk, ts)      │
└────────┘      └───────────────┘
                        ▼
                toUnqualifiedRecord()
                        ▼
            ┌───────────────────┐
            │ Metrics (unqualified)│
            │ { id, amount, ... } │
            └───────────────────┘
```

---

## 🎨 Usage Examples

### Building a View

```typescript
import { buildDataListView } from '@/lib/views';
import { warehouse } from '@/data/warehouse';

const rows = buildDataListView({
  store: warehouse,
  selectedObjects: ['payment', 'customer'],
  selectedFields: [
    { object: 'payment', field: 'id' },
    { object: 'payment', field: 'amount' },
    { object: 'customer', field: 'email' },
  ],
});

// Result:
// [
//   {
//     display: { "payment.id": "pi_001", "payment.amount": 29900 },
//     pk: { object: "payment", id: "pi_001" },
//     ts: "2025-03-15"
//   },
//   {
//     display: { "customer.email": "acme@example.com" },
//     pk: { object: "customer", id: "cus_001" },
//     ts: "2025-01-15"
//   },
//   ...
// ]
```

### Filtering by Date

```typescript
import { filterRowsByDate } from '@/lib/views';

const filtered = filterRowsByDate(
  rows,
  '2025-03-01',
  '2025-03-31'
);

// Only rows with ts in March 2025
```

### Sorting

```typescript
import { sortRowsByField } from '@/lib/views';

const sorted = sortRowsByField(
  rows,
  'payment.amount',
  'desc'
);

// Sorted by amount, highest first
```

### Getting Row Keys

```typescript
import { getRowKey } from '@/lib/views';

const rowKey = getRowKey(rows[0]);
// "payment:pi_001"

// Use for selection
const selectedKeys = new Set(selectedRows.map(getRowKey));
```

### Converting for Metrics

```typescript
import { toUnqualifiedRecord } from '@/lib/views';

const unqualified = toUnqualifiedRecord(rows[0], 'payment');
// { id: "pi_001", amount: 29900, created: "2025-03-15" }

// Pass to metric computation
const result = computeMetric({ rows: [unqualified], ... });
```

---

## 🏗️ Architecture Benefits

### Before (Scattered Logic)

```typescript
// DataList.tsx
const rawRows = joinForDisplay({ ... });
// Returns: { "payment.id": "pi_001", __meta: { ... } }

// ChartPanel.tsx
const dataRows = getRows('payment');
// Returns: { id: "pi_001", amount: 29900 }

// Different structures everywhere!
```

**Problems:**
- ❌ Inconsistent row structures
- ❌ __meta vs pk confusion
- ❌ Manual timestamp extraction
- ❌ Difficult to share code

### After (Unified RowView)

```typescript
// All components
import { buildDataListView } from '@/lib/views';

const rows = buildDataListView({ ... });
// Always returns: RowView[]

// Same structure everywhere!
```

**Benefits:**
- ✅ Single unified structure
- ✅ Type-safe access
- ✅ Automatic timestamp handling
- ✅ Easy to share code
- ✅ Predictable behavior

---

## 📋 Function Reference

### buildDataListView()

**Purpose:** Transform warehouse data to RowView[]

**Input:**
- `store` - Warehouse instance
- `selectedObjects` - Array of object names
- `selectedFields` - Array of {object, field} pairs

**Output:** RowView[]

**Features:**
- ✅ Handles both singular and plural object names
- ✅ Automatically qualifies all keys
- ✅ Picks canonical timestamp per object
- ✅ Filters fields by selected objects

---

### filterRowsByDate()

**Purpose:** Filter rows by date range

**Input:**
- `rows` - RowView[]
- `start` - ISO date string
- `end` - ISO date string

**Output:** Filtered RowView[]

**Features:**
- ✅ Uses ts field for filtering
- ✅ Excludes rows with null timestamps
- ✅ Inclusive range (start <= ts <= end)

---

### getRowKey()

**Purpose:** Generate rowKey from RowView

**Input:** RowView

**Output:** string (format: "object:id")

**Features:**
- ✅ Consistent with existing rowKey format
- ✅ Unique identifier for selection
- ✅ Compatible with GridSelection

---

### sortRowsByField()

**Purpose:** Sort rows by qualified field

**Input:**
- `rows` - RowView[]
- `qualifiedField` - Qualified field name
- `direction` - 'asc' or 'desc'

**Output:** Sorted RowView[]

**Features:**
- ✅ Handles numbers, strings, booleans
- ✅ Null values sorted to end
- ✅ Locale-aware string sorting
- ✅ Immutable (returns new array)

---

### toUnqualifiedRecord()

**Purpose:** Convert RowView to unqualified record

**Input:**
- `row` - RowView
- `object` - Object type to extract

**Output:** Unqualified record

**Features:**
- ✅ Removes qualification for metrics
- ✅ Filters to single object type
- ✅ Always includes id from pk
- ✅ Ready for computeMetric()

---

## 🧪 Test Coverage

### Test Results
```
PASS  src/lib/__tests__/views.test.ts
  View Utilities
    buildDataListView
      ✓ creates RowView[] with qualified keys
      ✓ handles multiple objects
      ✓ handles empty selections
      ✓ handles invalid object names
      ✓ picks canonical timestamp for each object
    filterRowsByDate
      ✓ filters rows within date range
      ✓ returns empty array for range with no data
      ✓ excludes rows without timestamps
    getRowKey
      ✓ generates rowKey from RowView
      ✓ works with different object types
    sortRowsByField
      ✓ sorts ascending
      ✓ sorts descending
      ✓ handles null values
      ✓ sorts strings
    toUnqualifiedRecord
      ✓ converts RowView to unqualified record
      ✓ filters out fields from other objects
      ✓ always includes id from pk

Test Suites: 1 passed, 1 total
Tests:       17 passed, 17 total
```

---

## 🚀 Next Steps (Optional)

### Phase 2 - Component Integration
- [ ] Update DataList.tsx to use buildDataListView
- [ ] Update ChartPanel.tsx to use filterRowsByDate
- [ ] Update filters to use getRowKey

### Phase 3 - Advanced Features
- [ ] Add pagination support
- [ ] Add virtual scrolling
- [ ] Add lazy loading
- [ ] Add row grouping

---

## ✅ Result

The RowView structure successfully:
1. **Unifies data structure** - Same shape everywhere
2. **Ensures qualified keys** - Always uses qualify()
3. **Includes primary key** - { object, id } for identity
4. **Provides timestamp** - Automatic via pickTimestamp()
5. **Enables bi-directional conversion** - To/from unqualified

**Server Status:** ✅ Running on http://localhost:3001
**Compilation:** ✅ Success
**Tests:** ✅ 17/17 passing
**Ready for:** DataList, Charts, Filters to adopt

---

**Implementation Date:** 2025-10-29
**Status:** ✅ COMPLETE
**Next:** Components can now use RowView for consistent data handling
