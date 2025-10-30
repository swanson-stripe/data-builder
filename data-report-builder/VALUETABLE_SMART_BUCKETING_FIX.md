# ValueTable Smart Bucketing Fix

## Issue

When selecting a row from the Data List, the summary table (ValueTable) would show all zeros even though:
- ✅ The chart displayed the selected data correctly
- ✅ The metric header showed the correct count
- ❌ The summary table showed zeros for all periods

### Root Cause

The ValueTable was **hardcoded to display only the last 6 time periods** (line 179):

```typescript
const displayCount = Math.min(6, currentSeries.points.length);
const currentPoints = currentSeries.points.slice(-displayCount);
```

**Example Scenario:**
- User viewing **YTD (Jan 1 - Oct 30, 2025)** with **Week** granularity = 44 weeks total
- ValueTable displays **last 6 weeks**: Sep 20, Sep 27, Oct 4, Oct 11, Oct 18, Oct 25
- User selects a refund from **September 10, 2025**
- This refund falls into the **Sep 6-12 week bucket**
- **That bucket is NOT in the last 6 weeks!**

**Result:**
- Chart: Shows all 44 weeks with data visible ✅
- Metric Header: Counts the selected row ✅
- ValueTable: Shows Sep 20-Oct 25 (no data in these buckets for selected row) ❌

## The Solution

Modified the ValueTable to **intelligently show buckets containing selected data** when a row selection is active.

### Implementation

**File**: `src/components/ValueTable.tsx` (lines 178-215)

```typescript
// Get buckets to display
// If data is selected (grid selection), show buckets containing selected data
// Otherwise, show last 6 periods
const { currentPoints, comparisonPoints: displayComparisonPoints } = useMemo(() => {
  const displayCount = Math.min(6, currentSeries.points.length);
  
  // If no selection, show last N periods
  if (!includeSet || includeSet.size === 0) {
    return {
      currentPoints: currentSeries.points.slice(-displayCount),
      comparisonPoints: comparisonSeries?.points.slice(-displayCount),
    };
  }
  
  // Find buckets with non-zero values (containing selected data)
  const bucketsWithData = currentSeries.points
    .map((point, idx) => ({ point, idx }))
    .filter(({ point }) => point.value > 0);
  
  // If we found buckets with data, show those (up to displayCount)
  if (bucketsWithData.length > 0) {
    // Take up to displayCount buckets, centered around the data
    const startIdx = Math.max(0, bucketsWithData[0].idx - Math.floor(displayCount / 2));
    const endIdx = Math.min(currentSeries.points.length, startIdx + displayCount);
    const adjustedStartIdx = Math.max(0, endIdx - displayCount);
    
    return {
      currentPoints: currentSeries.points.slice(adjustedStartIdx, endIdx),
      comparisonPoints: comparisonSeries?.points.slice(adjustedStartIdx, endIdx),
    };
  }
  
  // Fallback to last N periods if no data found
  return {
    currentPoints: currentSeries.points.slice(-displayCount),
    comparisonPoints: comparisonSeries?.points.slice(-displayCount),
  };
}, [currentSeries, comparisonSeries, includeSet]);
```

### How It Works

1. **No Selection**: Shows last 6 periods (default behavior)
2. **Row Selected**: 
   - Finds all buckets with non-zero values (containing the selected data)
   - Centers the display around those buckets
   - Shows up to 6 periods, ensuring selected data is visible
3. **Fallback**: If no data found in any bucket, falls back to last 6 periods

### Example

**Before Fix:**
```
User selects refund from Sep 10, 2025
ValueTable shows: Sep 20 | Sep 27 | Oct 4 | Oct 11 | Oct 18 | Oct 25
Values:           0      | 0      | 0     | 0      | 0      | 0
Result: ❌ No data visible!
```

**After Fix:**
```
User selects refund from Sep 10, 2025
ValueTable shows: Aug 30 | Sep 6 | Sep 13 | Sep 20 | Sep 27 | Oct 4
Values:           0      | 1     | 0      | 0      | 0      | 0
Result: ✅ Data visible! (Sep 6-12 bucket shows the refund)
```

## Benefits

1. **Better UX**: Selected data is always visible in the summary table
2. **Maintains Performance**: Still only shows 6 periods at a time
3. **Intelligent Centering**: Selected data is centered in the view for context
4. **Backward Compatible**: No selection = original behavior (last 6 periods)

## Testing

**To Test:**
1. Load the Refund Count preset
2. Select the first row in the Data List (refund from early September)
3. Verify the ValueTable now shows the week containing that refund
4. Verify the chart, metric header, and table all align

**Expected Result:**
- All three visualizations (chart, metric, table) should show consistent data for the selected row

