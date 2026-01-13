# Project Primer

## Project Overview
**Data Report Builder** — A no-code analytics interface for building custom reports and visualizations from Stripe payment data. Think "internal BI tool" with AI-assisted report generation.

---

## Baseline Stack
- **Languages**: TypeScript, HTML/CSS, React
- **Runtime**: Node, Browser
- **Framework**: Next.js 16 (App Router)
- **React**: 19.2.0
- **UI**: Tailwind CSS 4, custom components
- **Charts**: Recharts 3.3.0
- **Data**: react-window (virtualization)
- **AI**: OpenAI 6.8.1

---

## Architecture

### Data Flow (3 Layers)
```
WAREHOUSE (src/data/warehouse.ts)
  ↓ 560 records, 10 entity types
FIELD UTILITIES (src/lib/fields.ts)
  ↓ qualify/unqualify, timestamp resolution
VIEW LAYER (src/lib/views.ts)
  ↓ RowView transformation
COMPONENTS (DataList, ChartPanel, etc.)
```

### State Management
- **Global**: React Context (`src/state/app.tsx`)
- **60+ Actions**: Fully typed with discriminated unions
- **Key State**: selectedFields, metric, filters, groupBy, chart config

### Core Components (34 total)
- **DataTab.tsx** (3,111 lines) - Primary data selection UI
- **MetricTab.tsx** - Metric configuration
- **ChartTab.tsx** - Visualization controls
- **DataList.tsx** - Virtualized table
- **ChartPanel.tsx** - Recharts integration

---

## Key Features
1. **Multi-Block Metrics** - Complex formulas (rates, ratios)
2. **Data Packages** - Curated dataset collections
3. **Advanced Filtering** - 8 operators, AND/OR logic
4. **Smart Grouping** - Field-based segmentation (max 10 values)
5. **Time Bucketing** - Day/week/month/quarter/year granularity
6. **AI Report Gen** - Natural language → report config
7. **Accessibility** - ARIA labels, keyboard nav, screen readers

---

## Style & Philosophy
- **Style**: Pragmatic; project-appropriate
- **Testing**: Smoke tests required, unit tests where helpful (6 test suites exist)
- **Exploration tolerance**: Low–medium when a plan exists
- **Component Size**: Large components acceptable when cohesive (DataTab = 3,111 lines)

---

## Non-Negotiables
- No significant refactors without explicit approval
- Avoid hacky or fragile implementations
- Do not add complexity to compensate for poor understanding
- Preserve three-layer data architecture (Warehouse → Fields → Views)
- Maintain qualified/unqualified field distinction
- Keep type safety throughout (AppState, AppAction, etc.)

---

## Definition of Done
- Code compiles (`npx tsc --noEmit`)
- Tests pass (when applicable)
- Documentation updated (markdown files in root)
- Goals fully achieved and verifiable
- Dev server runs without critical errors (`npm run dev`)

---

## File Locations (Critical Paths)

### State & Types
- `src/state/app.tsx` - Global state, 60+ actions
- `src/types.ts` - Core type definitions

### Data Layer
- `src/data/warehouse.ts` - 560 mock records
- `src/data/schema.ts` - Entity definitions
- `src/lib/fields.ts` - Field qualification utilities
- `src/lib/views.ts` - RowView transformation

### Key Utilities
- `src/lib/metrics.ts` - Metric calculation engine
- `src/lib/filters.ts` - Filter application
- `src/lib/grouping.ts` - Grouping logic
- `src/lib/time.ts` - Date bucketing
- `src/lib/presets.ts` - Report presets (20+)

### Main Components
- `src/components/DataTab.tsx` - Data selection (3,111 lines)
- `src/components/MetricTab.tsx` - Metric builder
- `src/components/ChartPanel.tsx` - Chart controls
- `src/components/DataList.tsx` - Virtualized table

---

## Development Commands
```bash
npm run dev              # Start dev server (http://localhost:3000)
npm run build            # Production build
npx tsc --noEmit         # Type check
npm run lint             # ESLint
```

---

## Recent Work (Main Branch)
- Latest commit: `37f0ef6` - Fix field chip styling and filter popover positioning
- Completed: Dataset renovation, accessibility polish, guided tour, data packages
- Active: UI refinements, filter improvements

---

## Documentation
Root directory contains extensive markdown documentation:
- `DATASET-RENOVATION-COMPLETE.md` - Data architecture overhaul
- `PROMPT_10_SUMMARY.md` - Accessibility & testing implementation
- `STRIPE_SCHEMA_COMPLETE.md` - Schema integration details
- Various fix logs: `*_FIX.md`, `*_IMPLEMENTATION.md`

---

## Gotchas & Constraints
1. **Field Qualification**: Always use qualified names (`object.field`) in UI, unqualified in business logic
2. **Timestamp Resolution**: Use `pickTimestamp()` from fields.ts (priority-based)
3. **RowView Structure**: `{ display, pk, ts }` is canonical for all UI components
4. **Bucket Limits**: Max 500 time buckets to prevent performance issues
5. **Group Limits**: Max 10 group values for clarity
6. **Package Awareness**: Some fields only visible in specific data packages

---

## Testing Strategy
- **Unit Tests**: 6 test suites in `src/lib/__tests__/`
  - fields.test.ts (22 cases)
  - views.test.ts (17 cases)
  - metrics.test.ts
  - time.test.ts (17 cases)
  - format.test.ts (15 cases)
- **Integration**: Manual verification via dev server
- **Accessibility**: WCAG 2.1 AA compliance targeting

---

## Known Tech Debt
- DataTab.tsx at 3,111 lines (cohesive but large)
- Some test suites written but runner not installed (esbuild issues)
- Console.log statements in production code (debugging artifacts)
- Loading state management could be simplified

---

## Project Context
This is an internal tool prototype demonstrating:
- No-code analytics builder concepts
- AI-assisted report generation
- Complex metric calculation system
- Stripe data model integration

**Not** production-deployed; focus on feature completeness and UX polish.

