# Test Suite

## Overview

This directory contains comprehensive unit tests for the utility functions in `format.ts` and `time.ts`.

## Test Files

- **format.test.ts** - Tests for formatting utilities (currency, numbers, dates, percentages)
- **time.test.ts** - Tests for time/date range utilities (granularity, validation, bucketing)

## Test Coverage

### format.ts
- ✅ Currency formatting (small amounts, thousands, millions, compact mode)
- ✅ Number formatting (integers, decimals with custom precision)
- ✅ Date range formatting
- ✅ Percentage change calculations (positive, negative, edge cases)
- ✅ Short date formatting

### time.ts
- ✅ Range generation by granularity (day, week, month, quarter, year)
- ✅ Bucket label formatting for all granularities
- ✅ Granularity-range validation (preventing excessive data points)
- ✅ Automatic granularity suggestion based on date range

## Running Tests

### Note on Vitest Setup

Due to an esbuild binary installation issue on this ARM64 Mac (SIGKILL error), Vitest installation was blocked. This is the same esbuild issue that led to choosing Next.js over Vite for the main project.

### Workarounds

1. **TypeScript Validation**: All test files are written in TypeScript and can be validated:
   ```bash
   npx tsc --noEmit
   ```

2. **Jest Alternative** (if needed):
   ```bash
   npm i -D jest @types/jest ts-jest
   npx ts-jest config:init
   npm test
   ```

3. **Manual Testing**: All utility functions are pure (no side effects) and can be tested in Node REPL:
   ```bash
   node --loader ts-node/esm src/lib/__tests__/format.test.ts
   ```

## Test Structure

All tests follow the standard describe/it/expect pattern and are fully typed. They can be run with any test runner that supports TypeScript (Jest, Vitest, Mocha, etc.) once the esbuild issue is resolved.

## Why These Tests Matter

1. **Format Utilities**: Critical for consistent UI display across charts, tables, and value comparisons
2. **Time Utilities**: Prevent performance issues from excessive data points (500+ bucket validation)
3. **Edge Cases**: Cover zero values, infinity, large numbers, and date boundaries
4. **Type Safety**: All tests are fully typed, ensuring compatibility with the codebase

## Future Improvements

Once the esbuild binary issue is resolved, run:
```bash
npm i -D vitest jsdom @testing-library/react @testing-library/jest-dom
```

Then add to `package.json`:
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui"
  }
}
```
