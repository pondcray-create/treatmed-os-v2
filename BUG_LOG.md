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

## BUG-2026-03-30-002: DB write fails silently during pilot

- **Status:** Fixed
- **Severity:** High
- **Area:** `AS API` (`app/api/as/state/route.ts`, `app/api/as/organizations/route.ts`)

### Symptom
- UI can still show data (local fallback), but Neon SQL shows no new rows.
- After refresh, some pages look empty or stale when DB read/write is not healthy.

### Forensic Root Cause
- Runtime errors from DB write path were swallowed by client-side best-effort fallback.
- API routes returned generic 500 with empty body, making incident diagnosis slow.
- Neon schema had `updatedAt` not-defaulted rows from prior sync state, causing create/upsert failures for new records.

### Fix
- Added explicit try/catch JSON error responses in AS API routes:
  - `/api/as/state`
  - `/api/as/organizations`
- Backfilled and set DB defaults for `updatedAt` (`DEFAULT now()`) on pilot tables.
- Added one-time migration script and pilot daily checklist runbook.

### Anti-pattern (Do not repeat)
- "Silent fallback success" in UI without observability on DB write failures.

### Verification
1. POST to `/api/as/state` and `/api/as/organizations` returns `ok: true`.
2. Add customer in UI and confirm row appears in `as_organizations`.
3. Confirm `app_state_blobs.updatedAt` moves after Stock/Service actions.
