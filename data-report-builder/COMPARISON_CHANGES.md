# Comparison Value Changes

## Summary
Modified the metric header delta/comparison value to only show when a comparison mode is selected in the Chart tab, and to display both absolute and relative (percentage) changes.

## Changes Made

### 1. Removed Benchmark Comparison Option
- **Files Modified:** 
  - `src/state/app.tsx`
  - `src/components/ChartTab.tsx`
  - `src/components/ChartPanel.tsx`
  - `src/components/ValueTable.tsx`

- **Changes:**
  - Removed `'benchmark'` from `Comparison` type
  - Removed `benchmark` field from `ChartSettings` type
  - Removed `SetBenchmarkAction` and its reducer case
  - Removed `setBenchmark` action creator
  - Removed benchmark option from Chart Tab UI
  - Removed benchmark input field
  - Removed benchmark cases from ChartPanel and ValueTable

### 2. Updated Comparison Mode Behavior

#### Period Start Baseline
- **Before:** Compared all values to first period (functionality was in chart)
- **Now:** Metric header compares current (latest) value to the first bucket value
- Works like a stock tracker baseline

#### Previous Period
- **Before:** Compared to previous bucket
- **Now:** Same behavior, but now controlled by Chart tab selection

#### Previous Year
- **Before:** Compared with same period one year ago
- **Now:** Same behavior, finds closest bucket ~12 months prior

### 3. Modified MetricHeader Delta Display

**File:** `src/components/MetricHeader.tsx`

**New Delta Calculation:**
```typescript
const delta = useMemo(() => {
  // Only show delta if comparison is enabled
  if (state.chart.comparison === 'none' || !metricResult.series || metricResult.series.length === 0) {
    return null;
  }

  const current = metricResult.series[metricResult.series.length - 1].value;

  switch (state.chart.comparison) {
    case 'period_start':
      // Compare to first value in the period
      const baseline = metricResult.series[0].value;
      return { absolute: current - baseline, baseline };

    case 'previous_period':
      // Compare to previous bucket
      const previous = metricResult.series[metricResult.series.length - 2].value;
      return { absolute: current - previous, baseline: previous };

    case 'previous_year':
      // Find closest bucket approximately 12 months ago
      // ... implementation details ...
      return { absolute: current - closestBucket.value, baseline: closestBucket.value };
  }
}, [metricResult, state.chart.comparison]);
```

**New Display Format:**
- Shows both absolute and relative change
- Example: `+$12,095.76 (+12.9%)`
- Color coded:
  - Green for positive changes
  - Red for negative changes
  - Gray for zero change

### 4. Updated Chart Tab Descriptions

Updated the comparison mode descriptions to be more accurate:
- **Period Start Baseline:** "Compare current value to the first bucket in the period"
- **Previous Period:** "Compare with the previous bucket (e.g., last month)"
- **Previous Year:** "Compare with the same bucket one year ago"

## Behavior

### When to Show Delta
- Delta is **hidden** when comparison is set to "None"
- Delta is **shown** when any comparison mode is selected (period_start, previous_period, previous_year)

### What Delta Shows
The delta now displays two pieces of information:
1. **Absolute Change:** The raw difference in the metric's units
   - Currency metrics: `+$1,234.56` or `-$1,234.56`
   - Count metrics: `+42` or `-42`
2. **Relative Change:** The percentage change
   - Always shown in parentheses: `(+12.9%)` or `(-5.2%)`

### Example Display
```
Gross Volume
$105,754.71  +$12,095.76 (+12.9%)
```

## Testing
- ✅ Build successful with no TypeScript errors
- ✅ All comparison modes removed references to benchmark
- ✅ MetricHeader correctly shows/hides delta based on comparison setting
- ✅ Both absolute and percentage changes display correctly

## Files Modified
1. `src/state/app.tsx` - Type definitions and reducers
2. `src/components/ChartTab.tsx` - UI and options
3. `src/components/ChartPanel.tsx` - Removed benchmark case
4. `src/components/ValueTable.tsx` - Removed benchmark cases
5. `src/components/MetricHeader.tsx` - New delta calculation and display

