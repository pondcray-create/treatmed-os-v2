# BUG LOG

This file is the forensic incident registry.  
Rule: every production-impact bug must be recorded with root cause and prevention.

## BUG-2026-03-20-001: Stock item disappears after navigation

- **Status:** Fixed
- **Severity:** High
- **Area:** `AS Stock` persistence (`app/(dashboard)/as/stock/page.tsx`)

### Symptom
- After receiving item into Stock (especially from Commissioning return), item appears briefly.
- After navigating away and coming back, item disappears.

### Forensic Root Cause
- `StockPage` had a write effect that persisted `items` on mount.
- React state starts from seed/default values before localStorage hydration completes.
- The write effect could run too early and overwrite valid persisted stock data with stale seed state.

### Fix
- Added hydration gate:
  - `stockHydratedRef` defaults to `false`.
  - Set to `true` only after local storage hydration finishes.
  - Skip `writeStockItemsWithVersion(...)` until hydrated.
- Added first-write skip gate:
  - Skip first persistence write cycle after mount.
  - Prevent effect closure from writing pre-hydration seed/default state.
  - Applied same protection pattern to transactions/bookings writes.

### Anti-pattern (Do not repeat)
- Persisting mount-time default state before hydration is complete.

### Regression Tests
- `scripts/tests/stock-hydration-guard.test.cjs`
  - Verifies hydration gate exists in `stock/page.tsx`:
    - `stockHydratedRef`
    - `stockHydratedRef.current = true`
    - `if (!stockHydratedRef.current) return`
  - `stockFirstWriteSkippedRef` + skip guard before write effect

### Verification
1. Receive product into Stock.
2. Navigate away and return.
3. Refresh page.
4. Confirm item still exists.
