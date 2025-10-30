# Time Range Button Styling Fix

## Issue
The time range preset buttons (1M, 3M, YTD, 1Y, 3Y, 5Y) had no visual indication of which one was currently selected, making it difficult for users to know what date range was being displayed in the chart.

## Problem
All buttons had identical styling regardless of whether they were selected or not:
- Same gray border
- Same gray background on hover
- No highlighted/active state

This created confusion as users couldn't tell which time period they were viewing without looking at the date range text below.

## Solution

### Added Selected State Detection
For each time range button, the component now:
1. Calculates what the preset's date range would be (`range = preset.getValue()`)
2. Compares it to the current app state (`state.start` and `state.end`)
3. Sets `isSelected = true` if they match

### Added Visual Differentiation
**Selected button styling:**
- Blue background (`bg-blue-500`)
- Blue border (`border-blue-500`)
- White text (`text-white`)
- Darker blue on hover (`hover:bg-blue-600`)
- Works in both light and dark modes

**Unselected button styling:**
- Gray border (`border-gray-200 dark:border-gray-700`)
- Gray text (`text-gray-700 dark:text-gray-300`)
- Light gray background on hover (`hover:bg-gray-100 dark:hover:bg-gray-600`)

### Added Accessibility
- Added `aria-pressed` attribute that reflects selection state
- Screen readers will announce "pressed" or "not pressed" for each button

## Implementation

**File Modified:** `src/components/ChartPanel.tsx` (lines 333-357)

**Before:**
```tsx
<button
  onClick={() => {
    const range = preset.getValue();
    dispatch(actions.setRange(range.start, range.end));
  }}
  className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
>
  {preset.label}
</button>
```

**After:**
```tsx
{rangePresets.map((preset) => {
  const range = preset.getValue();
  const isSelected = state.start === range.start && state.end === range.end;
  
  return (
    <button
      onClick={() => {
        dispatch(actions.setRange(range.start, range.end));
      }}
      className={`px-2 py-1 text-xs border rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        isSelected
          ? 'bg-blue-500 border-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:border-blue-600 dark:hover:bg-blue-700'
          : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
      }`}
      aria-pressed={isSelected}
    >
      {preset.label}
    </button>
  );
})}
```

## Visual Result

**Before:**
```
┌────┬────┬─────┬────┬────┬────┐
│ 1M │ 3M │ YTD │ 1Y │ 3Y │ 5Y │  ← All buttons look identical
└────┴────┴─────┴────┴────┴────┘
```

**After (with 1Y selected):**
```
┌────┬────┬─────┬────────┬────┬────┐
│ 1M │ 3M │ YTD │ ██1Y██ │ 3Y │ 5Y │  ← Selected button is highlighted in blue
└────┴────┴─────┴────────┴────┴────┘
```

## User Benefits

1. **Immediate Visual Feedback**: Users can instantly see which time period is active
2. **Reduced Cognitive Load**: No need to mentally calculate or read fine print to understand current view
3. **Consistent UI Pattern**: Matches common UI conventions where selected/active states are highlighted
4. **Dark Mode Support**: Works correctly in both light and dark themes
5. **Accessibility**: Screen reader users are informed of button states via ARIA attributes

## Testing

To verify the fix:
1. Open the report builder in the browser
2. Click different time range buttons (1M, 3M, YTD, etc.)
3. The clicked button should:
   - Turn blue with white text
   - Remain highlighted while that range is active
   - Return to gray when another range is selected

Test in both light and dark modes to ensure proper contrast.

## Related Components

This fix only applies to `ChartPanel.tsx`. Other components don't currently have time range buttons, but if they're added in the future, this pattern should be followed for consistency.

## Summary

✅ **Problem:** No visual indication of selected time range  
✅ **Solution:** Added blue highlighted state for selected button  
✅ **Result:** Clear, immediate feedback on active time period  
✅ **Accessibility:** Added `aria-pressed` for screen readers  
✅ **Theme Support:** Works in both light and dark modes  

Users can now easily identify which time period they're viewing at a glance.

