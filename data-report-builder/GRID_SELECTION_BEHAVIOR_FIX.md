# Grid Selection Behavior Fix

## Issue

When selecting cells/rows in the Data List, the grid selection was affecting:
- ✅ Chart (correct)
- ✅ Summary Table (correct)
- ❌ **Metric Header value** (incorrect)

This was inconsistent with the reverse behavior:
- When clicking chart points or table cells → filters Data List but **NOT the metric header**

The metric header should show the **overall metric value** for the entire dataset, regardless of grid selection.

## Root Cause

The `includeSet` logic in all three components (`MetricHeader.tsx`, `ChartPanel.tsx`, `ValueTable.tsx`) was identical - they all included grid selection in the filter calculation.

```typescript
// Old logic (all 3 components)
if (state.selectedGrid && state.selectedGrid.rowIds.length > 0) {
  return new Set(state.selectedGrid.rowIds.map(pk => `${pk.object}:${pk.id}`));
}
```

This caused the metric header to recalculate based on selected rows, which was not the desired behavior.

## The Solution

**Modified `MetricHeader.tsx` only** to exclude grid selection from its `includeSet`:

```typescript
// Build PK include set from field filters only (exclude grid selection)
// Grid selection should only affect chart/table, not the headline metric
const includeSet = useMemo(() => {
  // Only use field filters, not grid selection
  if (state.filters.conditions.length > 0 && state.selectedObjects.length > 0 && state.selectedFields.length > 0) {
    const rawRows = buildDataListView({
      store: warehouse,
      selectedObjects: state.selectedObjects,
      selectedFields: state.selectedFields,
    });
    
    const filteredRows = applyFilters(rawRows, state.filters);
    
    // Extract PKs from filtered rows
    return new Set(filteredRows.map(row => `${row.pk.object}:${row.pk.id}`));
  }
  
  // No filtering - return undefined to use all data
  return undefined;
}, [
  state.filters,       // Only depends on field filters now
  state.selectedObjects,
  state.selectedFields,
  // ❌ Removed: state.selectedGrid?.rowIds
]);
```

**Left unchanged:**
- `ChartPanel.tsx` - Chart SHOULD respond to grid selection
- `ValueTable.tsx` - Summary table SHOULD respond to grid selection

## New Behavior

### Before Fix:
```
Select row in Data List:
  Metric Header: $166.79 → $1.85 ❌ (changes based on selection)
  Chart: Shows only selected data ✅
  Summary Table: Shows only selected data ✅
```

### After Fix:
```
Select row in Data List:
  Metric Header: $166.79 → $166.79 ✅ (stays constant)
  Chart: Shows only selected data ✅
  Summary Table: Shows only selected data ✅
```

### Consistent with Reverse Direction:
```
Click chart point or table cell:
  Metric Header: $166.79 → $166.79 ✅ (unchanged)
  Data List: Filters to selected bucket ✅
  Chart: Highlights selection ✅
```

## Benefits

1. **Consistent UX**: Grid selection and bucket selection now behave symmetrically
2. **Metric Stability**: Headline metric value remains stable during exploration
3. **Clear Semantics**: 
   - Metric Header = "What's the overall number?"
   - Chart/Table = "How does it break down over time?"
   - Data List = "What are the individual records?"
4. **Field Filters Still Work**: The metric header correctly responds to field-based filters (e.g., `subscription.status = 'active'`)

## Files Modified

1. **`src/components/MetricHeader.tsx`** (lines 24-47)
   - Removed grid selection from `includeSet` calculation
   - Removed `state.selectedGrid?.rowIds` from dependency array

2. **`src/components/ChartPanel.tsx`** (line 143)
   - Added clarifying comment: "Chart/table SHOULD respond to grid selection"

3. **`src/components/ValueTable.tsx`** (line 34)
   - Added clarifying comment: "Value table SHOULD respond to grid selection"

## Testing

**To verify the fix:**

1. Load any preset (e.g., MRR)
2. Note the metric header value (e.g., "$214,562.35")
3. Select a row in the Data List
4. **Expected**: 
   - Metric header stays "$214,562.35" ✅
   - Chart shows only selected data ✅
   - Summary table shows only selected data ✅
5. Click a chart point or table cell
6. **Expected**:
   - Metric header still "$214,562.35" ✅
   - Data List filters to that time bucket ✅

