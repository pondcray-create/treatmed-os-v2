# Pilot DB Migration and Daily Checklist

This runbook is for the 1-month pilot while AS still has hybrid behavior (DB + localStorage mirror).

## A) One-time migration from staff browser dump -> central DB

### 1) Export localStorage dump on each staff machine
Open browser DevTools Console on the app domain and run:

```js
(() => {
  const keys = [
    "as_organizations",
    "as_service_jobs",
    "as_stock_items",
    "as_stock_transactions",
    "as_stock_bookings",
    "as_stock_dispatches",
    "as_repair_to_cal_requests",
    "as_parts_requests",
    "as_commissioning_claim_cases",
    "as_se_incoming_requests",
  ]
  const out = {}
  for (const key of keys) out[key] = localStorage.getItem(key)
  console.log(JSON.stringify(out, null, 2))
})()
```

Save output as `staff-name-dump.json` (UTF-8).

### 2) Run one-time migration script
From project root:

```bash
node scripts/as-one-time-migrate-to-db.cjs --file ./staff-name-dump.json --base-url https://treatmed-os-v2.vercel.app
```

Repeat for each staff dump file.

### 3) Verify after each import
Run in Neon SQL:

```sql
SELECT COUNT(*) FROM as_organizations;
SELECT COUNT(*) FROM as_service_jobs;
SELECT key FROM app_state_blobs ORDER BY key;
```

---

## B) Daily pilot validation checklist (operations)

### Startup checks (every morning)
- Open `AS / Customers`, `AS / Service Request`, `AS / Stock` and confirm lists load after refresh.
- Add 1 test customer and delete it (or mark clearly as test) to verify write path.
- Confirm quick action menu in Stock opens fully without clipping.

### Cross-device checks (once per day)
- Device A: create/update 1 customer and 1 job.
- Device B: refresh same pages and verify data appears.
- Device B: update status once, Device A refresh and confirm sync.

### DB health checks (Neon SQL)

```sql
SELECT COUNT(*) AS orgs FROM as_organizations;
SELECT COUNT(*) AS jobs FROM as_service_jobs;
SELECT key, "updatedAt" FROM app_state_blobs ORDER BY "updatedAt" DESC LIMIT 20;
```

- Expect counts non-zero and `updatedAt` to move when users perform actions.

### Incident response
- If UI shows data but SQL count does not move:
  - Check Vercel env vars: `DATABASE_URL`, `NEXT_PUBLIC_AS_DB_MODE`.
  - Redeploy latest production.
  - Re-run a write action and re-check SQL.
- If SQL write fails:
  - Capture API response body (now includes explicit error JSON).
  - Record incident in `BUG_LOG.md`.

---

## C) Exit criteria for pilot
- 7 consecutive days with no data-loss incident.
- Cross-device sync pass rate 100% on daily check.
- DB counts increase in line with operational activity.
- Team can restore from Neon backup snapshot.

---

## D) Clean mock/test data (reset app to clean state)

### DB cleanup (safe default: keep settings)

```bash
npm run clean:pilot-data -- --yes
```

- Clears runtime AS/SE data tables + `app_state_blobs`.
- Keeps settings tables intact.

### Full cleanup including settings

```bash
npm run clean:pilot-data -- --yes --include-settings
```

### Browser localStorage cleanup (per machine)
Run in DevTools console on app domain:

```js
(() => {
  const keys = Object.keys(localStorage).filter((k) => {
    return (
      k.startsWith("as_") ||
      k.startsWith("se_") ||
      k === "global_settings" ||
      k === "kpi_settings" ||
      k === "product_catalog"
    )
  })
  for (const k of keys) localStorage.removeItem(k)
  console.log("removed keys:", keys.length, keys)
})()
```
