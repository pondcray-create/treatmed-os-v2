# Incident Log: Stock item disappears after navigation

## Incident
- Symptom: Item received into Stock (especially after Commissioning return) appears briefly, then disappears after leaving and returning to the Stock page.
- Impact: High. Data appears lost to users and breaks trust in workflow.

## Root Cause
- `StockPage` initializes React state with dev seed data.
- On first mount, the `items` persistence effect ran before hydration from local storage was fully applied.
- This caused seed `items` to be written back to storage and overwrite newer real data.

## Technical Detail
- A write effect for `items` executed on mount without waiting for local-storage hydration completion.
- Result: stale/seed payload could clobber persisted stock records.

## Fix Implemented
- Added hydration guard in `StockPage`:
  - `stockHydratedRef` starts as `false`.
  - Set to `true` only after local storage hydration effect finishes.
  - Skip `writeStockItemsWithVersion(...)` until hydration is complete.

## Why this prevents recurrence
- Ensures mount-time seed/default state cannot write over persisted real stock data.
- Writes happen only after page state is hydrated from storage snapshot.

## Verification Steps
1. Receive a product from Commissioning into Stock.
2. Confirm item appears in Stock list.
3. Navigate to another page and return to Stock.
4. Hard refresh browser.
5. Confirm the same item still exists.

## Regression Guard Checklist
- Any page with local-storage hydration must gate persistence writes until hydration completes.
- Avoid mount-time write effects that depend on seed/default state.
- For new modules, use the same pattern: `hydratedRef/current` guard around storage writes.
