# Safe admin maintenance

This change is branch-only until explicitly approved for main. Main deploys the
production frontend/backend. No workflow changes are required.

## Before deployment

1. Back up the persistent `where2eat.db` while the service is stopped or with
   SQLite's backup API. Keep it outside the deployed checkout. Test its restore.
2. Confirm the backend and workers use the same persistent `DATABASE_DIR`.
   The main DB and new `cost_estimates.db` must survive deploys. Multiple service
   replicas with separate disks do NOT share the budget guard.
3. Set `COST_MONTHLY_BUDGET_USD` (default 10). From the provider billing consoles,
   verify current UTC-month spend up to the start of tracking, including pending
   charges. Set `COST_OPENING_MONTH=YYYY-MM` and `COST_OPENING_SPEND_USD` to that
   amount. Do not set zero merely to unblock a request. The opening value is
   inserted once per month; changing environment values does not erase history.
   Missing current-month opening spend blocks instrumented paid calls. Arrange
   a fresh verification at each UTC month boundary. Do not delete the ledger.
4. Review the dated price constants in `src/cost_ledger.py`. Prices older than
   90 days block reservations. Only Gemini 2.5 Flash is priced; another configured
   model fails closed. This is an estimate, not Google's balance or a guarantee
   against spend by other clients, keys, replicas or external activity. Set
   provider-side billing alerts too. No free allowances or credits are deducted.
5. Existing `/api/episodes/seed` and mention deletion now require admin bearer
   authentication; `/api/episodes/reset` requires super_admin. Update manual
   scripts that used these endpoints. The old restaurant merge endpoint returns
   410 after authentication: use the preview-bound maintenance API instead.
6. Smoke-test authentication and preview flows in staging using a copy of the
   database, without invoking paid providers. Do not run a destructive smoke
   test on production. No paid API call was used to validate this change.

## Maintenance flow

Open the existing dashboard's Maintenance page. Input exact IDs, inspect the
full JSON preview and identity fields, then confirm. Previews include a hash of
current affected rows. Changes after preview require a new preview. Merge
conflicts, missing source moments and active queued/processing episodes block
execution rather than offer a force override.

- Merge repoints mentions and hides the duplicate restaurant, retaining source
  mention names, quotes and timestamps. Review identity, address, photos and
  source moments before confirming. Similar names alone are not proof.
- Episode deletion removes only that episode and its mentions. Restaurants with
  surviving direct or Place-ID-linked mentions are reparented to a remaining
  episode. Unshared episode-owned restaurants are removed; audit rows remain
  with their restaurant link detached. Stale/missing shared episodes block it.
- Mention repair permits a small field allowlist, never source quotes or times.
  The original Hebrew label is saved on first repair. Public mention display
  uses a visible linked restaurant's canonical name and returns the source label
  separately as `original_name_hebrew`.
- Every mutation and its full before/after snapshot commit in one SQLite
  transaction. Admins can inspect `/api/admin/maintenance/operations/{id}`.
- Undo restores exact rows only when post-operation rows are unchanged and no
  new linked mentions/queue activity conflict. It refuses rather than overwrites
  later edits. A refusal needs manual review against the snapshot, not retries.

## Cost tracking

Reservations are atomic and occur before an instrumented outbound attempt. A
network failure retains the reservation because billing outcome is uncertain.
Gemini settlement counts input, candidate output and thinking tokens; missing or
partial metadata retains the ceiling. Places count attempts, including fallback
and retry calls. The ledger stores no key, URL, prompt or response. Calls are
grouped by run, SKU and UTC month. The dashboard flags 80% and stops requests that
would exceed the configured estimate. The HTTP response for a budget refusal is
429. Standalone legacy scripts and non-Gemini providers are not instrumented.

## Rollback

Prefer operation-level undo before reverting code. Stop workers before a full DB
restore. Keep both DB files and snapshots; reverting code does not undo data
changes and restoring only the main DB must not erase recorded provider costs.
The additive mention column and snapshot table are compatible with older code.

## Validation record (2026-11-06)

Focused backend suite: 110 passed, 3 skipped. Admin page tests: 3 passed.
Desktop and 390px mobile fixtures were rendered and visually inspected, including
a conflicting-identity preview with disabled confirmation. No production deploy.
Untouched origin/main reproduces four unrelated failures in queue/headers/admin
seed tests and the `admin/app/dashboard/analytics/page.tsx:111` TypeScript error.
These remain baseline issues, not a claim that the full suite is green.
