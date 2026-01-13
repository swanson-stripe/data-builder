# Map View Implementation Plan

## Goal
Add a Map View to the `/edit` route that visualizes report configuration as a draggable, connectable node canvas, powered by parallel state management and an existing canvas library.

**Success Criteria:**
- View switcher in top nav toggles between Table ↔ Map views
- Map View renders canvas with draggable elements representing data lists, charts, filters, etc.
- Elements connect with smooth bezier curves
- Left-side config panel with "New", "Chat with AI", "Templates", "Helper"
- Session persistence for view preference and canvas layout
- No breaking changes to existing Table View

---

## Implementation Plan

### Phase 1: Foundation & Routing (Steps 1-5)

**1. Create Map View state management**
- Add new file: `src/state/mapView.tsx`
- Define `MapViewState` type with:
  - `elements`: array of canvas elements (id, type, position, config)
  - `connections`: array of connections (sourceId, targetId)
  - `viewport`: zoom level, pan position
  - `selectedElementId`: currently selected element
- Create `MapViewContext`, `MapViewProvider`, and `useMapView` hook
- Define action types: `ADD_ELEMENT`, `UPDATE_ELEMENT`, `DELETE_ELEMENT`, `ADD_CONNECTION`, `DELETE_CONNECTION`, `SET_VIEWPORT`, `SELECT_ELEMENT`, `DESELECT_ELEMENT`, `RESET_MAP`
- Build reducer function following same pattern as `src/state/app.tsx`

**2. Add session persistence for Map View**
- Create utility file: `src/lib/mapSession.ts`
- Functions: `saveMapState(reportId, state)`, `loadMapState(reportId)`, `clearMapState(reportId)`
- Use `sessionStorage` to persist per report ID
- Add `getActiveView(reportId)` and `setActiveView(reportId, view)` for view preference

**3. Set up routing and view switching**
- Modify URL structure to use query param: `/edit?view=map` or `/edit?view=table`
- Update `src/app/edit/page.tsx` (or equivalent edit route file):
  - Read `view` query param
  - Load appropriate view based on param
  - Default to `table` view if no param or first visit
  - Check session for last active view and restore if exists
- No new route files needed, single `/edit` route handles both views

**4. Create view switcher UI component**
- New file: `src/components/ViewSwitcher.tsx`
- Positioned next to "Edit report" title in top nav
- Two buttons: "Table" and "Map"
- Active state styling matching existing nav patterns
- On click: update query param and trigger view change
- Store active view in session when switching

**5. Integrate React Flow library**
- Install: `npm install reactflow`
- Research React Flow API for:
  - Custom node types
  - Connection validation (if needed later)
  - Viewport controls (zoom, pan)
  - Custom edges (bezier curves)
- Verify compatibility with Next.js 16 and React 19

---

### Phase 2: Map View Layout & Canvas (Steps 6-10)

**6. Create Map View container component**
- New file: `src/components/MapView.tsx`
- Wrap in `MapViewProvider` from step 1
- Layout: left config panel + main canvas area
- Use existing background pattern from current view
- Maintain same theme tokens and styling

**7. Build canvas component**
- New file: `src/components/MapCanvas.tsx`
- Integrate React Flow:
  - `<ReactFlow>` wrapper with nodes and edges
  - Configure viewport controls (zoom, pan)
  - Set default zoom to 100%, centered
  - Enable dragging, panning, zooming
- Add zoom controls UI (buttons or on-screen widget)
- Add keyboard shortcuts: `Cmd/Ctrl +/-` for zoom
- Handle empty state: show helpful message when no elements

**8. Create config panel component**
- New file: `src/components/MapConfigPanel.tsx`
- Vertical layout, pinned to left edge
- Initial state: icon-only menu with 4 items:
  - New/Create (plus icon)
  - Chat with AI (chat icon)
  - Templates (template icon)
  - Helper (help icon)
- On hover: show text labels
- On click: expand panel smoothly with transition
- Expanded state shows second-layer content with close button
- Use existing design tokens for colors, shadows, transitions

**9. Build "New/Create" panel section**
- New file: `src/components/MapNewPanel.tsx`
- Expanded panel shows 6 options:
  - Field (with icon)
  - Chart (with icon)
  - Filter (with icon)
  - Grouping (with icon)
  - Metric (with icon)
  - SQL Query (with icon)
- Each option has description text
- On click, trigger appropriate "add element" flow
- Close button returns to icon-only panel

**10. Add session restore logic**
- In `MapView.tsx` `useEffect`:
  - On mount, check `sessionStorage` for saved state
  - If found, restore `elements`, `connections`, `viewport`
  - If not found, trigger auto-generation from existing report (step 13)
- On unmount or navigation away, save current state to session

---

### Phase 3: Canvas Elements (Steps 11-17)

**11. Design element type system**
- New file: `src/types/mapElements.ts`
- Define base `MapElement` type with:
  - `id`, `type`, `position` (x, y), `data` (element-specific config)
- Define element types enum: `DataList`, `Chart`, `Filter`, `Grouping`, `Metric`, `SQLQuery`
- Define `MapConnection` type: `id`, `source`, `target`, `type` (optional for styling)
- Define element-specific data structures extending base

**12. Build base canvas element component**
- New file: `src/components/canvas/BaseElement.tsx`
- Wrapper for all element types
- Handles:
  - Hover state (shows "+" buttons on edges)
  - Selected state (shows config menu above)
  - Dragging behavior
  - Connection points (left, right, bottom)
- Renders config menu bar when selected:
  - Element-specific action buttons
  - Delete button (trash icon)

**13. Build DataList canvas element**
- New file: `src/components/canvas/DataListElement.tsx`
- Reuse `DataList.tsx` component from table view
- Show first 20 rows with pagination
- Config menu buttons: "Add Field", "Settings"
- When "+" button clicked on edges: show "New" menu
- Connect to existing AppState for data fetching

**14. Build Chart canvas element**
- New file: `src/components/canvas/ChartElement.tsx`
- Reuse `ChartPanel.tsx` logic for rendering
- Show live chart with hover states
- Config menu buttons: Chart type, Date range, Granularity, Compare
- On segment click: trigger filter creation flow
- If no parent DataList: show "Add data to visualize" message
- Dropdown to select parent DataList when creating

**15. Build Filter canvas element**
- New file: `src/components/canvas/FilterElement.tsx`
- Reuse `FilterPopover.tsx` UI but render inline
- Show current filter conditions as chips
- Config menu button: "Edit Filters"
- Requires parent DataList (dropdown selection when creating)
- Apply filter logic using existing `src/lib/filters.ts`

**16. Build Grouping, Metric, SQL Query elements**
- New files:
  - `src/components/canvas/GroupingElement.tsx`
  - `src/components/canvas/MetricElement.tsx`
  - `src/components/canvas/SQLElement.tsx`
- Follow same pattern as Filter element
- Reuse existing components/logic:
  - Grouping: `GroupBySelector.tsx`
  - Metric: `MetricBlockCard.tsx`, `FormulaBuilder.tsx`
  - SQL: `SQLTab.tsx` code editor
- Each shows condensed view on canvas, full config in menu

**17. Implement connection rendering**
- Configure React Flow edge type: smooth bezier curves
- Style: match existing theme colors
- Hover effect: highlight curve
- Connection validation (single parent rule) in add connection logic
- Delete connection: click connection + hit Delete key

---

### Phase 4: Element Creation Flows (Steps 18-23)

**18. Build "Add Field" flow**
- When "Field" clicked in New panel:
  - Show data list search UI (reuse from `DataTab.tsx`)
  - On field selection:
    - Check if DataList element exists on canvas
    - If yes: add field to existing DataList element
    - If no: create new DataList element with field
  - Position new element near clicked "+" button or panel
  - Close panel, select new/updated element

**19. Build "Add Chart" flow**
- When "Chart" clicked in New panel:
  - Show dropdown: "Branch from DataList" or "Create standalone"
  - If branching: select parent DataList, create connection
  - Use existing chart auto-config logic from `src/state/app.tsx` line 588-638
  - Create Chart element with default settings
  - Position near parent or near panel
  - Close panel, select new element

**20. Build "Add Filter" flow**
- When "Filter" clicked in New panel:
  - Show required dropdown: "Select DataList to filter"
  - Once selected, create Filter element
  - Create connection from DataList to Filter
  - Open filter config UI inline
  - Position below parent DataList
  - Close panel, select new element

**21. Build "Add Grouping" flow**
- Similar to Filter flow
- Require parent DataList selection
- Reuse `GroupBySelector` component
- Create Grouping element + connection
- Position near parent

**22. Build "Add Metric" flow**
- Check for existing DataList elements
- If exists: auto-configure based on fields (like table view)
- If not: create with empty state
- Use existing metric calculation logic
- Position near data source if connected

**23. Build "Add SQL Query" flow**
- Show dropdown: "Branch from DataList" or "Create new"
- If branching: generate SQL from parent DataList data
- Show code editor inline on canvas
- Config option: "Update parent" or "Create new DataList"
- Handle both update and create-new scenarios

---

### Phase 5: AI Chat Integration (Steps 24-26)

**24. Build AI Chat panel section**
- New file: `src/components/MapChatPanel.tsx`
- Expanded panel shows:
  - Chat input field (multi-line textarea)
  - Submit button
  - Response area (shows last response)
- Basic styling matching existing chat UI

**25. Create AI chat processing logic**
- New file: `src/lib/mapAI.ts`
- Function: `processMapChatQuery(query, currentMapState, currentAppState)`
- Parse query for intent:
  - "Add [element type]" → trigger add flow
  - "Show [metric/chart] for [field]" → create connected elements
  - "Filter by [condition]" → add filter element
  - "Remove [element]" → delete element
- Return structured response: `{ action, message, updates }`
- Integrate with existing OpenAI endpoint (`src/app/api/*` if exists)

**26. Wire AI responses to canvas updates**
- In `MapChatPanel.tsx`, on submit:
  - Call `processMapChatQuery`
  - If `action` is defined, dispatch to MapViewContext
  - Update canvas with new elements/connections
  - Show response message in chat area
  - Clear input after submission

---

### Phase 6: Templates & Auto-generation (Steps 27-29)

**27. Build Templates panel section**
- New file: `src/components/MapTemplatesPanel.tsx`
- Expanded panel shows list of templates
- Templates: reuse existing presets from `src/lib/presets.ts`
- Each template card shows: name, description, icon
- On click: trigger template application

**28. Create canvas auto-generation logic**
- New file: `src/lib/generateMapFromReport.ts`
- Function: `generateMapLayout(appState)`
- Parse `appState` from table view:
  - `selectedObjects` + `selectedFields` → DataList element
  - `metric` + `metricFormula` → Metric element
  - `chart` → Chart element
  - `filters` → Filter element(s)
  - `groupBy` → Grouping element
- Calculate element positions:
  - DataList at left (x: 100, y: 100)
  - Filters below DataList (y offset: 200)
  - Chart to right of DataList (x offset: 400)
  - Metrics to right of Chart (x offset: 400)
- Create connections based on dependencies
- Return `{ elements, connections }`

**29. Implement template application**
- In `MapTemplatesPanel.tsx`:
  - On template click, load preset config
  - Apply to AppState (existing logic)
  - Call `generateMapLayout(newAppState)`
  - Dispatch to MapViewContext
  - Close panel, show generated canvas

---

### Phase 7: Helper & Utilities (Steps 30-33)

**30. Build Helper panel section**
- New file: `src/components/MapHelperPanel.tsx`
- Expanded panel shows:
  - Reuse content from existing `HelperPopover` component
  - Adjust layout for vertical panel
  - Include shortcuts, tips for Map View
- No special logic needed, static content

**31. Add keyboard shortcuts handler**
- In `MapCanvas.tsx`, add `useEffect` with keyboard listener:
  - `Backspace`/`Delete`: delete selected element
  - `Escape`: deselect element
  - `Cmd/Ctrl +`: zoom in
  - `Cmd/Ctrl -`: zoom out
- Dispatch appropriate actions to MapViewContext

**32. Build element connection UI (+ buttons)**
- In `BaseElement.tsx`:
  - Render "+" buttons on left, bottom, right edges
  - Only show on hover
  - On click: show "New" menu positioned near button
  - Pass parent element ID to creation flow
  - Auto-connect new element to parent

**33. Add transition confirmation when leaving Map View**
- In `ViewSwitcher.tsx`:
  - Before switching Map → Table:
    - Check if Map has unsaved changes (compare to initial state)
    - If yes: show modal confirming "Changes only in Map View"
    - User confirms: switch view
    - User cancels: stay on Map View

---

### Phase 8: Polish & Integration (Steps 34-38)

**34. Style all components with existing theme**
- Ensure all new components use:
  - Tailwind config from `tailwind.config.ts`
  - Color tokens from existing components
  - Fonts, spacing, shadows matching current design
- Test dark mode compatibility (if applicable)

**35. Add loading states**
- Show skeleton/spinner when:
  - Generating canvas from report
  - AI processing chat query
  - Applying template
- Use existing loading patterns from `src/state/app.tsx` loadingComponents

**36. Handle edge cases**
- Empty report (no fields selected): show empty canvas with "Get started" message
- Max elements (20): disable "Add" options when limit reached
- Overlapping elements: allow but ensure z-index stacking works
- Invalid connections: prevent during creation (single parent rule)

**37. Test session persistence**
- Verify state saves on:
  - Page refresh
  - Navigation away and back
  - View switch
- Verify state clears on:
  - Session end (browser close)
  - Manual reset (if we add)

**38. Final integration checks**
- Table View unchanged and functional
- No breaking changes to existing AppState
- TypeScript compiles with no errors
- Dev server runs without warnings
- All imports resolve correctly

---

### Phase 9: Documentation (Steps 39-40)

**39. Update project documentation**
- Add to `contracts/project-primer.md`:
  - Map View architecture section
  - File locations for new components
  - State management explanation
- Create new doc: `MAP_VIEW_IMPLEMENTATION.md`
  - Architecture diagram
  - Element types and connections
  - AI chat capabilities
  - Session persistence approach

**40. Create component documentation**
- Add JSDoc comments to:
  - All new components (purpose, props, usage)
  - State management functions
  - Utility functions
- Document MapViewState type thoroughly

---

## File Structure Summary

### New Files to Create (estimated 30+ files)
```
src/
├── state/
│   └── mapView.tsx
├── types/
│   └── mapElements.ts
├── lib/
│   ├── mapSession.ts
│   ├── mapAI.ts
│   └── generateMapFromReport.ts
├── components/
│   ├── ViewSwitcher.tsx
│   ├── MapView.tsx
│   ├── MapCanvas.tsx
│   ├── MapConfigPanel.tsx
│   ├── MapNewPanel.tsx
│   ├── MapChatPanel.tsx
│   ├── MapTemplatesPanel.tsx
│   ├── MapHelperPanel.tsx
│   └── canvas/
│       ├── BaseElement.tsx
│       ├── DataListElement.tsx
│       ├── ChartElement.tsx
│       ├── FilterElement.tsx
│       ├── GroupingElement.tsx
│       ├── MetricElement.tsx
│       └── SQLElement.tsx
contracts/
└── MAP_VIEW_IMPLEMENTATION.md
```

### Files to Modify
```
src/app/edit/page.tsx (or equivalent route file)
contracts/project-primer.md
package.json (add reactflow)
```

---

## Dependencies

**New Package:**
- `reactflow` (latest stable version compatible with React 19)

**Verify Compatibility:**
- React Flow with Next.js 16 App Router
- React Flow with TypeScript 5.x

---

## Risk Assessment

**Low Risk:**
- Parallel state prevents breaking Table View
- Session storage is non-critical (can fail gracefully)
- Library (React Flow) is battle-tested

**Medium Risk:**
- AI chat quality depends on prompt engineering
- Auto-layout algorithm may need tuning for complex reports
- Performance with 20 elements needs validation

**Mitigation:**
- Start with simple AI commands, expand iteratively
- Make auto-layout configurable (spacing, direction)
- Test with max elements early

---

## Success Metrics

✅ View switcher toggles between Table/Map  
✅ Canvas renders with draggable elements  
✅ All 6 element types render and configure correctly  
✅ Connections render as smooth curves  
✅ Config panel expands/collapses smoothly  
✅ AI chat can add basic elements  
✅ Templates auto-generate canvas  
✅ Session persistence works across navigation  
✅ Keyboard shortcuts functional  
✅ No breaking changes to existing Table View  
✅ TypeScript compiles without errors  

---

## Estimated Implementation Phases

- **Phase 1-2**: 2-3 days (foundation + layout)
- **Phase 3-4**: 3-4 days (elements + creation flows)
- **Phase 5-6**: 2-3 days (AI + templates)
- **Phase 7-8**: 2-3 days (polish + testing)
- **Phase 9**: 1 day (docs)

**Total estimate: 10-14 days** for full implementation

---

## Plan Status

**Created**: 2026-01-13  
**Status**: Approved by user, ready for Context Loader phase  
**Next Step**: Context Loader agent to identify specific files, APIs, and constraints

