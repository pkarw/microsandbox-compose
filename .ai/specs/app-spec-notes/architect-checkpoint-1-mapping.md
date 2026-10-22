# Architect checkpoint #1 — capability mapping (Execution: sequential fallback)

Inputs received: this App Spec so far + capability catalog + source files listed there.

## Checkpoint answers

1. **Did we miss a platform capability?** No high-confidence miss found for the MVP mapping: sandbox create/connect-or-create, detached mode, exec (tty/timeout/workdir), wait-for-status, list/handles all exist in the msb SDK surface. Remaining gaps are app-side mapping concerns (env_file, healthcheck, depends_on, networks, interpolation, restart) — documented in the WF gap matrices (Phase 2), not platform misses.

2. **Did we overengineer?** No — MVP is a thin CLI (compose-spec parse → mapper → lifecycle → cli). The compose→sandbox mapper being pushed upstream is flagged as a proposed shared module, not local re-implementation.

3. **dind rejection sanity check:** platform DOES ship a documented compose path (`msb run … docker dind` + `docker compose` inside, docs/how-to/ci-cd/compose-tests.mdx). Decision to reject it was made on product grounds (100% without Docker / no Docker in sandboxes), which the operator owns; the mapping therefore targets native per-service sandboxes only. Not a platform capability miss — a scope decision.

## Verdict
Checkpoint #1 passed. Continue to Phase 4 (phasing).