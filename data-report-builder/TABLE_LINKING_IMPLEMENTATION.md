# Table Relationship Visualization Implementation

## Overview

Enhanced the Data tab to visually show relationships between selected objects with connecting lines and improved sorting based on connection count.

## Features Implemented

### 1. Automatic Hierarchical Sorting
Selected objects are now sorted by connection count (descending), placing the most-connected tables at the top:
- Customer (14 connections) → appears first
- Subscription, Invoice, Charge (5-6 connections) → appear next
- Less connected tables follow
- Unselected objects remain alphabetically sorted

### 1.5. Expand-to-Enable for Unselected Objects
Users can now expand unselected objects and select fields directly:
- Expand button is always enabled (no longer disabled for unselected objects)
- Clicking a field checkbox in an unselected object automatically:
  - Enables/selects the parent object
  - Selects the clicked field
  - Moves the object to the selected section (sorted by connection count)
- Provides a more intuitive workflow for building queries

### 1.6. Enhanced Search with Field-Level Filtering
Search functionality now provides field-level results:
- Search matches against both object names/labels AND field names/labels
- Objects with matching fields automatically expand to show results
- Field list filters to show ONLY matching fields (non-matching fields are hidden)
- Empty search shows all fields (normal behavior)
- Provides instant visibility into where specific fields are located across all objects
- Inline clear button (X icon) appears inside search field when text is entered
- Removed redundant "Clear Filters" button for cleaner UI

### 2. Complete Relationship List
- Shows ALL relationships between selected objects (not just first 3)
- Removed "+X more" truncation
- Only displays connections to other currently selected objects

### 3. Cleaner Visual Design
- Removed "Selected" badge from object cards for cleaner appearance
- Selection state is already clear from checkbox state and positioning at top of list

### 4. Blank Preset and Reset Improvements
- Added "blank" preset option (displays as "—") for starting fresh reports
- When "New" button is clicked:
  - Preset dropdown changes to blank option
  - Date range resets to YTD (Year to Date: Jan 1 of current year to today)
  - All selections, filters, and customizations are cleared
- Initial app load now starts with **MRR preset** and YTD range
- Fixed warehouse provider to gracefully handle empty entity lists (blank preset case)
- **Disabled automatic preset switching**: Previously, selecting certain objects would automatically switch presets, which was disruptive. Users now have full control and must manually select presets from the dropdown.
- Shows relationship direction (→ or ←) and type (one-to-many)

### 3. Visual Connection Lines
- Blue SVG lines connect related object cards
- Arrows indicate direction of relationship
- Lines connect from bottom-center of source card to top-center of target card
- Only draws connections between currently selected objects
- Updates dynamically when selections change
- Non-interactive overlay (doesn't block card interactions)

### 4. Connection Count Badge
Added connection count indicator on each selected object card showing:
- "X connections" or "X connection" (singular)
- Displayed in blue next to "Selected" badge
- Only shown for selected objects with active connections

## Technical Implementation

### Code Changes

**File**: `src/components/DataTab.tsx`

#### Imports
Added:
- `useRef`, `useEffect`, `forwardRef` from React
- State management for card positions and refs

#### ObjectCard Component
- Converted to `forwardRef` to accept DOM ref
- Added `selectedRelationships` filter to only show connected selected objects
- Added connection count badge in header
- Shows complete relationship list (no truncation)
- Added ref to root div for position tracking

#### DataTab Component
Added:
- `cardPositions` state to track card DOM positions
- `cardRefs` ref to store references to each ObjectCard
- `containerRef` ref for the scrollable container
- `getConnectionCount()` helper function
- Updated sorting logic to sort by connection count
- `useEffect` to update positions on changes and window resize
- SVG overlay with connection lines and arrowheads

### Visual Design

**Connection Lines**:
- Color: `#3b82f6` (blue-500)
- Stroke width: 2px
- Arrowhead marker at end of line
- Lines avoid duplicates by only drawing from 'from' object

**Layout**:
- SVG positioned absolutely with `pointer-events-none`
- Z-index: 0 (behind cards but above container background)
- Lines calculate relative to container for scroll compatibility

## Example Relationships

When these objects are selected, they appear in this order with connections:

1. **Customer** (14 connections)
   - → subscription
   - → invoice
   - → payment
   - → charge
   - → payment_method
   - → quote
   - → credit_note
   - → subscription_schedule
   - → payment_intent
   - → customer_balance_transaction
   - → customer_tax_id
   - → checkout_session
   - → discount
   - → invoice_item

2. **Subscription** (5 connections)
   - ← customer
   - → invoice
   - → subscription_item
   - → discount
   - → subscription_schedule
   - → checkout_session

3. **Price** (2 connections)
   - ← product
   - → subscription_item

## Preset Report Examples

**MRR Preset** activates and connects:
- Customer → Subscription → Subscription_item → Price

**Gross Volume Preset** activates and connects:
- Customer → Charge → Payment_intent → Invoice

**Active Subscribers Preset** activates and connects:
- Customer → Subscription → Invoice

## Benefits

1. **Visual Hierarchy**: Most-connected tables appear first, showing data flow naturally
2. **Complete Information**: No hidden relationships, all connections visible
3. **Dynamic Updates**: Connections update in real-time as objects are selected/deselected
4. **Non-Intrusive**: Visual indicators don't interfere with existing functionality
5. **Accessible**: Connection count and relationship text remain readable

## Performance Considerations

- Position calculations use `requestAnimationFrame` for smooth updates
- SVG only renders when 2+ objects selected
- Filters duplicates by only drawing from 'from' object
- Window resize handler cleanup prevents memory leaks
- Refs stored in object for efficient lookup

## Styling Tweaks (Update)

Fixed connection line positioning to ensure lines connect center-bottom to center-top of cards:

### Changes Made:
1. **Scroll Offset Handling**: Added scroll position tracking to SVG coordinate calculations
2. **Z-Index Layering**: 
   - SVG overlay: `zIndex: 1`
   - Object cards: `zIndex: 2` (ensures cards appear above lines)
3. **Position Calculations**: Include `scrollTop` and `scrollLeft` offsets in position tracking
4. **Scroll Event Listener**: Update line positions dynamically when scrolling
5. **Visual Improvements**:
   - Increased stroke width to 2.5px (from 2px)
   - Added 0.8 opacity for subtler appearance
   - Lines now clearly connect center-to-center vertically

### Technical Details:
```typescript
// Position calculation with scroll offset
positions[name] = {
  width: rect.width,
  height: rect.height,
  top: rect.top - containerRect.top + scrollTop,
  bottom: rect.bottom - containerRect.top + scrollTop,
  left: rect.left - containerRect.left + scrollLeft,
  right: rect.right - containerRect.left + scrollLeft,
  // ... other properties
} as DOMRect;
```

Lines connect precisely from:
- **From card**: `(left + width/2, bottom)`
- **To card**: `(left + width/2, top)`

This creates a clear vertical flow showing the relationship hierarchy.

### Additional Visual Improvements:
1. **Increased Card Spacing**: Selected cards now have `mb-4` (16px) margin instead of `mb-2` (8px) for better visual separation
2. **Smaller Arrows**: Reduced arrowhead size from 10x10 to 8x8 for cleaner, less obtrusive appearance
3. **Dynamic Spacing**: Only selected cards get extra spacing; unselected cards maintain compact layout
4. **Two-Line Header Layout**: Restructured object card headers to prevent title obscuring:
   - **Line 1**: Object title + "Selected" badge
   - **Line 2**: Connection count + Field count
   - Provides clearer visual hierarchy and improves readability

```typescript
// Dynamic margin based on selection state
className={`... ${isObjectSelected ? 'mb-4' : 'mb-2'}`}

// Smaller, cleaner arrowhead
<marker markerWidth="8" markerHeight="8" refX="7" refY="2.5">
  <polygon points="0 0, 8 2.5, 0 5" fill="#3b82f6" />
</marker>

// Two-line header layout
<div className="flex-1 min-w-0">
  {/* Title row */}
  <div className="flex items-center gap-2">
    <label>{object.label}</label>
    <span>Selected</span>
  </div>
  
  {/* Metadata row */}
  <div className="flex items-center gap-3 mt-1">
    <span>X connections</span>
    <div>Y fields (Z selected)</div>
  </div>
</div>
```

## Build Status

```bash
npm run build
✓ Compiled successfully in 1.8s
✓ TypeScript passed with no errors
✓ No linter errors
```

## Testing Checklist

- [x] Objects sort by connection count when selected
- [x] Complete relationship lists shown (no truncation)
- [x] SVG lines connect related selected objects
- [x] Arrows point in correct direction
- [x] Connection count badge displays
- [x] Lines update when selections change
- [x] Scroll doesn't break line positions
- [x] No interference with existing interactions
- [x] Dark mode compatibility
- [x] Build succeeds without errors

## Future Enhancements

Potential improvements for later:
- Curved lines for better visual separation
- Hover to highlight related objects
- Click line to show relationship details
- Toggle to show/hide all relationships (including unselected)
- Different line colors for different relationship types
- Zoom/pan for large relationship graphs

