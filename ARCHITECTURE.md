# ARCHITECTURE GUARDRAILS

This document defines non-negotiable architecture rules for state, persistence, and UI behavior.

## Persistence and Hydration Rules

1. **Hydration-first persistence**
   - Any page that reads from localStorage/sessionStorage must complete hydration before writing.
   - Use a hydration gate (`hydratedRef` or equivalent) and block write effects before hydration.

2. **No mount-time clobber writes**
   - Never persist seed/default state on initial mount unless it is explicitly intended bootstrap behavior.
   - Seed data must not overwrite existing persisted user data.

3. **Versioned writes for shared stores**
   - Shared stores must use version/concurrency checks (`*_with_version`) to avoid stale overwrite.

4. **Cross-tab sync safety**
   - Storage event listeners must hydrate from current storage snapshot and never assume local in-memory state is newest.

## Anti-pattern Rules

- **Forbidden anti-pattern:** `useEffect(() => writeStore(state), [state])` without hydration guard for storage-backed state.
- **Forbidden anti-pattern:** implicit seed write that runs before storage read.

## Incident Linkage

- Every fix for a production-impact bug must:
  1. Add/update entry in `BUG_LOG.md`.
  2. Add architecture rule if bug reveals a reusable anti-pattern.
  3. Add regression test that fails if the anti-pattern returns.

## Session Startup Requirement (Cursor)

- At the beginning of every coding session, agent must read:
  - `ARCHITECTURE.md`
  - `BUG_LOG.md`
- If a change touches persistence/state logic, agent must reference these rules before editing.
