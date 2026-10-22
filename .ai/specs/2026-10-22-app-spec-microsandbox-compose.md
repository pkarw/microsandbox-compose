# App Spec: Microsandbox Compose

> The App Spec is a business architecture document that sits above feature specs.
> It captures domain knowledge, validates cross-spec consistency, and ensures
> the app solves a real business problem using the platform correctly.
>
> This document is the SINGLE SOURCE OF TRUTH for what this app is, who it serves,
> and how it maps to the platform. Feature specs are generated from this document.
> If a spec contradicts this document, this document wins.

---

## 1. Business Context `PM`

### 1.1 Business Model

**App:** Microsandbox Compose (`microsandbox-compose`) — a TypeScript CLI published to npm as `microsandbox-compose`, repository `github.com/superradcompany/microsandbox-compose`, that reads a `docker-compose.yml` and runs each compose service as an isolated Microsandbox microVM through the Microsandbox orchestrator (`msb` / `microsandbox`, https://github.com/superradcompany/microsandbox).

**Deployment shape:** Node/TypeScript package (bin `microsandbox-compose`, with composable subcommands), orchestration backend = the Microsandbox native runtime (napi bindings / `msb` CLI, local backend first).

**Business model:** Developer-tool infrastructure. Revenue stream is future-facing (managed/commercial backend tier); today the payer is the platform owner (the operator of the product). End buyers: engineering teams that run AI-agent workloads and want hardware isolation without leaving compose ergonomics.

**Flywheel:**

```
compose-defined workload (services: db, cache, app, agent)
        │
        ▼
npx microsandbox-compose up ──▶ per-service: sandbox = microVM (hardware isolated)
        │
        ▼
untrusted AI agent / user code runs INSIDE the microVM — no Docker, no host netns
        │
        ▼
safe, fast, instant-start sandboxing becomes the org standard
        │
        ▼
more compose stacks run on microVMs → more upstream capability feedback
        │
        ▼
better sandbox runtime + compose ergonomics → stronger flywheel
```

### 1.2 Business Goals

**Primary goal:** turn a `docker-compose.yml` into isolated Microsandbox sandboxes with one command — replacing host-Docker execution of agent/untrusted workloads with microVM isolation while keeping familiar compose syntax.

**Primary measurable goal:** "compose file → running sandboxes, one command, no Docker anywhere." Measurable outcomes:
- Time from `npx microsandbox-compose up` invocation to all enabled services running: target ≤ 2 minutes for a typical stack (boot < ~100 ms per sandbox, plus image pulls).
- Safety outcome: agent code executes inside a microVM with its own kernel/network context — no Docker daemon, no host socket, no shared host netns. **Decision (2026-10-22, operator): 100% without Docker** — native per-service microVM sandboxes only; Docker-based execution (host Docker, docker socket, dind/compose-inside-VM) is rejected.
- **Network outcome:** All sandboxes within a Compose project share a single private network with service name resolution; host port conflicts trigger explicit errors.

**Secondary goal:** dogfood Microsandbox capability surface through compose ergonomics; surface mapper gaps upstream (compose→sandbox mapping as a first-class path).

**What is NOT important:** multi-node orchestration, swarm semantics, service scaling beyond 1:1, GUI, billing (v1), cloud backend (v1 local), **any Docker usage** (v1 and later — the operator's explicit directive).

### 1.3 Ubiquitous Language

| Term | Definition | Source of data | Period |
|------|-----------|----------------|--------|
| sandbox | One microVM workload managed by Microsandbox (`msb`); named, persisted, or ephemeral; the unit of execution. | Microsandbox DB + local runtime | persistent / ephemeral |
| microVM | Hardware-virtualized guest execution context created by the Microsandbox runtime (libkrunfw). | Runtime config | session |
| compose file | YAML describing a multi-service stack (`docker-compose.yml` / `compose.yaml`). | User file | project |
| compose project | Logical group of services from one compose file; named by the top-level `name:` key when present, else the directory name. | Compose file contents | project |
| compose service | One workload (image + command/env/ports/volumes) in the compose file; maps 1:1 to one sandbox in this app. | File contents | project |
| image | OCI image reference (docker.io/..., ghcr.io/...) used as the sandbox rootfs. | Registry | immutable |
| init | Guest init handoff mechanism (`cmd: auto` or explicit) replacing Docker ENTRYPOINT semantics. | Builder config | per-sandbox |
| env | Key/value guest env injected into the sandbox process. For MVP, supports `${VAR:-default}` interpolation using host environment variables or defaults. | Builder `env`/`envs` | per-sandbox |
| env_file | Compose file of env vars (`.env` format); **MVP: unsupported, will error if present**. | User file | per-sandbox |
| port mapping | `hostPort:containerPort` (plus optional bind address) published host→guest. | Builder `port`/`portBind` | runtime |
| volume | **MVP only bind mounts (host dir)**; named volumes unsupported. | Builder `volume`/`named` | per-sandbox |
| healthcheck | Compose-defined readiness probe; **MVP: parsed but not used for startup** — runtime has no composite health concept (§10). | File contents | per-sandbox |
| restart policy | Compose `restart:`; **MVP: unsupported, will error if present**. | File contents | project |
| profile | Compose top-level/per-service profile gating (`--profile`); app resolves enabling flags (MVP: CLI flag + default). | File contents | project |
| depends_on | Service ordering; **MVP: topological start order only (no healthcheck-based waiting)**. | File contents | project |
| ephemeral | Sandbox that is auto-removed at terminal status (vs persistent). | Builder `ephemeral` | lifecycle |
| internal network | A private network managed by the Microsandbox runtime for sandboxes in the same project; enables service-to-service communication via service name resolution. | Runtime | session |
| internal DNS | Service names resolved to sandboxes within the same project's network via Microsandbox's internal DNS. | Runtime | session |

**Ubiquitous-language decisions:**
- "service" (compose) is the user-facing concept; "sandbox" (runtime) is the implementation unit. One compose service = one sandbox, 1:1 in MVP. The words are NOT synonyms — mapping layer responsibility.
- "up" = start enabled sandboxes in dependency order; "down" = stop + remove sandboxes.
- All sandboxes within a project automatically share a single internal network with service name resolution — top-level `networks` configuration in compose files is ignored.
- In MVP, all volumes specified in services must be bind mounts (host paths); named volumes will error.
- In MVP, `env_file` and `restart` policies will error if present; `depends_on` is handled via topological order only (no healthcheck-based waiting).

### 1.4 Domain Model

**Entities (precise fields):**

- `ComposeFile`: `{ project: string, services: Record<string, ComposeService>, volumes: Record<string, VolumeConfig> [MVP: ignored], networks: Record<string, NetworkConfig> [MVP: ignored], profiles: string[] }` — parsed from compose-spec YAML.
- `ComposeService`: `image: string`, `command: string[]`, `entrypoint: string[]`, `env: Record<string,string>`, `env_file: string[]` **(MVP: unsupported)**, `ports: PortMapping[]`, `volumes: VolumeMount[]`, `networks: string[]` **(MVP: ignored; all services use default internal network)**, `depends_on: string[]`, `healthcheck?: Healthcheck`, `restart?: RestartPolicy` **(MVP: unsupported)**, `profiles: string[]`, plus resource overrides (`cpus`, `memory`) where supported by compose-spec.
- `Sandbox`: `name: string`, `backendKind: "local"`, `status: "created"|"starting"|"running"|"draining"|"paused"|"stopped"|"crashed"`, `image`, `cmd`, `env`, `mounts`, `cpus`, `memory`, `ports`, `networkPolicy: {type: "internal", networkName: string}`, `ephemeral`, `maxDuration`, `idleTimeout`.
- `Exec`: `sandbox + argv + tty + env + workdir + timeout → ExecOutput { code, success, output }`.

**Invariants:**
1. One compose service → exactly one sandbox (MVP, 1:1). Scaling out of scope (Phase 3).
2. Sandbox names limited to 128 UTF-8 bytes (msb constraint) — long compose project/service names need deterministic truncation strategy (open question).
3. Ephemeral by default only for explicitly ephemeral services; persistent otherwise.
4. Port mapping host→guest semantics preserved (`port(hostPort, guestPort)`, `portBind(bind, hostPort, guestPort)`).
5. **All sandboxes in the same project share a single private network with service name resolution.**
6. No Docker anywhere: no docker socket mount, no dind, no inner daemon — **operator-mandated decision: 100% without Docker** (native microVM mapping only).

**Business rules:**
- A compose service whose profiles are not enabled by the current invocation is skipped (or error with hint) — MVP: `--profile` flags + default-on behavior for services without profiles.
- `depends_on` → topological start order only (MVP), no health-based gating (Phase 2).
- Env interpolation `${VAR:-default}` — MVP: pass-through from host env with default support (compose semantics).

## 2. Identity Model `PM`

- **Personas:** (a) the local developer/operator running the stack (internal persona, machine-local, no auth), (b) the AI agent executing inside the sandbox (untrusted workload — not a persona of the product but the primary consumer of isolation).
- **Decision:** single internal surface; local CLI; no external identity, no portal, no auth (local dev tool — v1). Portal decision: **NOT USED** (single-machine tool; adding auth would be Phase 2+ scope creep).
- **Decision log:**
  - 2026-10-22 — Identity: local machine-local CLI; no auth, no portal (v1).
  - 2026-10-22 — Architecture: 100% without Docker — native microVM sandboxes only; Docker-based execution paths (host Docker, docker socket, dind, compose-inside-VM) rejected by operator.
- **Agentic cost note:** none — the agent-facing surface is the sandbox itself plus this compose CLI, both inside the trusted product scope.

## 3. Workflows `PM`

### WF1: `microsandbox-compose up`

**Journey:** user runs `npx microsandbox-compose up` in a project dir → CLI locates compose file (`docker-compose.yml`/`compose.yaml`) → resolves profiles → maps each enabled service to an `msb` sandbox → creates sandboxes (detached) in topological order **with all sandboxes connected to a shared internal network for service name resolution** → reports status.

**ROI:** time from compose file to running isolated sandboxes: target ≤ 2 minutes for a typical stack (image pulls + <100 ms boot per sandbox); safety: untrusted agent code isolated without Docker; KPI tracked: `up`-to-running duration per stack.

**Boundaries:**
- Starts when: user runs `up` (or `up <service>`).
- Ends when: all enabled sandboxes reach `running` (MVP: running state; healthcheck gating deferred — Phase 2).
- NOT this workflow: scaling out (`scale`), rolling updates, swarm, cloud orchestration.

**Edge cases:**
1. Compose file missing → friendly error, exit non-zero.
2. Image pull failure → fail that service, continue others? (decision: fail fast per-service with clear error).
3. Port conflict on host → error with port + service context.
4. Sandbox name collision → `replace` semantics or error (msb `SandboxBuilder.replace`).

**Platform readiness (per step):**

| Step | Platform capability | Gap? | Notes |
|------|--------------------|------|-------|
| Locate + read compose file | App code (YAML) | new | compose-spec subset parsing |
| Resolve profiles | App code | new | CLI flags |
| Compose service → sandbox mapping (image/cmd/env/mounts/ports/resources) | msb SDK `SandboxBuilder` | covered | Phase 2 gaps listed below |
| Create sandboxes (detached, dependency order) | msb SDK `create`/`connectOrCreate`, `detached` | covered | |
| Wait for running status | msb `waitForStatus` | covered | |

Phase 2 addition gaps (mapped to msb capabilities): `env_file` parsing (app-side), healthcheck gating (app-side wait logic over `running` status; runtime lacks composite health — needs upstream or app-side probe), `depends_on` (app-side topological ordering; runtime has no dependency concept), restart policies (app-side mapping to lifecycle), named volumes ↔ msb Volume (covered by `Volume` builder concept, mapping TBD).

### WF2: `microsandbox-compose down`

**Journey:** `up` → later `down` → stop each started sandbox (graceful) and remove.

**ROI:** clean teardown; no orphan VMs — KPI: `down` leaves zero running sandboxes (invariant).

**Boundaries:** Starts/ends as user-driven.

**Edge cases:** unknown service names, sandbox already stopped (idempotent), ephemeral vs persistent removal semantics.

### WF3: `microsandbox-compose exec`

**Journey:** user/agent runs `npx microsandbox-compose exec <service> -- <cmd> [args...]` → CLI resolves service→sandbox → exec via msb exec (stdio, tty, workdir, timeout).

**ROI:** compose-like ergonomics (`--` separator) over msb exec; agent usage — KPI: exec sessions launched through the CLI carry tty/timeout/workdir correctly.

**Boundaries:** interactive TTY and detached modes (MVP: interactive + exec-with-capture).

### WF4: `microsandbox-compose status`

**Journey:** `npx microsandbox-compose status` → list sandboxes with status/image/ports.

**ROI:** operational visibility; reduces "is it running?" friction — KPI: status command reflects actual sandbox states.

**US-1.4** As a developer, I run `npx microsandbox-compose status` and get a read-only listing of the compose-defined sandboxes (name, image, status, ports) so I can see what `up` managed.

**Success:** listing reflects actual sandbox states.
**Failure:** no compose file / no enabled services → friendly "nothing to run" state.

## 3.5 UI Architecture `PM + UX`

CLI-first (terminal) UI; no web surface in v1.

- Command taxonomy: `up`, `down`, `exec`, `status` (+ `--help`), flags `--file`, `--project`, `--profile`, `--json`.
- Output contract: table of `{service, sandbox, status, image, ports}`; logs streaming during `up`; exec follow-logs.
- Key flows: up+status; exec.
- Empty states: no compose file → error message with expected filename; no enabled services → "nothing to run".
- Error UX: per-service error isolation, clear remediation hints (e.g. docker hub auth).

## 4. Workflow Gap Analysis `Architect`

### Gap Scoring — Atomic Commits

| Score | Meaning | Example |
|-------|---------|---------|
| 0 | Platform does it, zero commits | sandbox create/exec covered |
| 1 | 1 commit: config/seed only | profile resolution flag handling |
| 2 | 1–2 commits: small gap | compose YAML subset parse + mapping |
| 3 | 2–3 commits: medium gap | healthcheck/depends_on support |
| 4 | 3–5 commits: large gap | full compose-spec parity |
| 5 | 5+ commits or external dep | e.g. full env_file templating engines |

### Per-Workflow Gap Matrix

#### WF1: `up` — Estimated: 6–9 atomic commits

| Step | Platform capability | Gap | Scope | Commits | Notes |
|------|--------------------|-----|-------|---------|-------|
| Locate + read compose file | App code | new | app | 1 | compose-spec subset parsing |
| Resolve profiles | App code | new | app | 1 | CLI flags |
| Compose service → sandbox mapping (image/cmd/env/mounts/ports/resources) | msb SDK | covered | — | 0 | Phase 2 gaps: `env_file`, healthcheck (parsed but unused), depends_on (topological only), restart policies, named volumes |
| Create sandboxes (detached, topology order) | msb SDK | covered | — | 0 | |
| Wait for running status | msb `waitForStatus` | covered | — | 0–1 | |

#### WF2: `down` — Estimated: 2–3 commits
Stop/destroy covered at msb level; app glue (idempotency, service-set diff) = app commits.

#### WF3: `exec` — Estimated: 1–2 commits
msb exec covered; app: argv shaping (`--` separator, tty, timeout, workdir propagation).

#### WF4: `status` — Estimated: 1–2 commits
msb list/handles covered; app: output rendering.

### Gap Summary

| Workflow | Priority | Atomic commits (raw) | Workaround? | Commits (effective) | Blocks ROI? |
|----------|----------|---------------------|-------------|---------------------|-------------|
| WF1 `up` | high | ~6–9 (+phase2 ~4) | no | ~6–9 | no — MVP ships without |

## 4.5 Module Architecture `Architect`

**Platform capabilities used:** microVM runtime, sandbox builder, exec, volumes, network policy, secrets, snapshots, CLI `msb` commands.

**Proposed app modules:**
1. `compose-spec` — compose YAML subset reader/validator (project, services, volumes, networks, profiles).
2. `mapper` — ComposeService → SandboxConfig translation with explicit gap handling (Phase 0: covered fields only).
3. `lifecycle` — orchestrates up/down/status/exec sessions across services (ordering, idempotency).
4. `cli` — commander-style surface, output formatting, error mapping.

**Shared-module proposal:** `compose→sandbox` translation as a microsandbox upstream capability (reusable by other orchestrators/CI).

## 5. User Stories `PM`

### WF1: `up`

**US-1.1** As a developer running AI-agent workloads from a compose file, I run `npx microsandbox-compose up` and get each service running as an isolated microVM sandbox — with no Docker — so that untrusted agent code is hardware-isolated and the stack comes up in one command.

**Success:** compose file services start; sandboxes running; clear status output.
**Happy path:** `docker-compose.yml` with db+cache+app → `up` → all running (services communicate via internal DNS).
**Alternate:** service with `profiles` not enabled → skipped; `--profile agents` enables.
**Failure:** image pull failure → that service errors with remediation; port conflict → error before start; `env_file` or named volume present → explicit error.

### WF2: `down`

**US-1.3** As a developer, I run `npx microsandbox-compose down` and get all started sandboxes stopped and removed cleanly (idempotent).

**Success:** teardown completes; no orphan sandboxes remain.
**Failure:** sandbox already stopped → treated as already-down (idempotent).

### WF3: `exec`

**US-1.2** As a developer or agent, I exec into a service sandbox with compose-style addressing (`exec <service> -- <cmd>`) so I can operate the sandbox as if it were a container.

**Success:** exec runs in the mapped sandbox with tty/timeout/workdir semantics preserved.
**Failure:** sandbox not running → clear error; unknown service → error.

### WF4: `status`

**US-1.4** As a developer, I run `npx microsandbox-compose status` and get a read-only listing of the compose-defined sandboxes (name, image, status, ports) so I can see what `up` managed.

**Success:** listing reflects actual sandbox states.
**Failure:** no compose file / no enabled services → friendly "nothing to run" state.

### Cross-Story Impact Matrix

| Story | State changed | Stories affected | Impact | Mitigation |
|-------|--------------|-----------------|--------|------------|
| US-1.1 | sandbox lifecycle 0→running, host resource allocation | US-1.3 (teardown contract), US-1.2 (exec precondition), US-1.4 (status correctness) | down must handle running sandboxes; exec must key off running state | exec-before-down → clear error; down idempotent |
| US-1.3 | sandbox stopped/removed state | US-1.1 (re-up after down), US-1.2 (exec-after-down error path) | re-up after down must re-create | down is idempotent; up re-creates |
| US-1.2 | exec session state | US-1.1 (sandbox must be running to exec), US-1.3 (no exec after down) | none new; preconditions already disjoint | error paths covered |
| US-1.4 | read-only observation | none | none | n/a |

Conflict patterns: none active — lifecycle preconditions (running vs stopped) are disjoint across stories; no concurrent mutation paths in MVP.

## 6. User Story Gap Analysis `Architect`

| Story | Platform Match | Atomic Commits | Notes |
|-------|---------------|----------------|-------|
| US-1.1 | msb SDK sandbox create/exec/wait; app compose parsing/mapping | ~6–9 | see WF1 matrix |
| US-1.3 | msb stop/destroy + app idempotency glue | ~2–3 | see WF2 matrix |
| US-1.2 | msb exec covered; app argv glue | ~1–2 | see WF3 matrix |
| US-1.4 | msb list/handles covered; app rendering | ~1–2 | see WF4 matrix |

## 7. Phasing & Rollout `PM`

### Phase 1 — MVP: "compose up → native sandboxes"
- Goal: `npx microsandbox-compose up` / `down` / `status` / `exec` for a covered compose subset — native microVM mapping only, no Docker of any kind. Supported fields: image, command/entrypoint, env (with `${VAR:-default}` interpolation), ports, bind volumes (host paths), CPU/memory, profiles. All services on a single shared network with service name resolution. Unsupported fields: `env_file`, `restart` policies, named volumes; healthchecks parsed but not used for startup; `depends_on` for topological order only.
- Why first: operator-mandated no-Docker decision makes native mapping the only acceptable v1; delivers core value immediately.
- Acceptance: covered subset works end-to-end; no Docker invoked anywhere. For the known stacks (plain OCI images: pgvector, redis, meilisearch, localstack, opencode), the covered subset is expected to be the full set of fields those files use.

### Phase 2 — Compose parity
- healthchecks (wait logic), depends_on health-based gating, env_file parsing, restart policies, named volumes ↔ msb Volume.

### Phase 3 — Surface expansion
- scale, networks policy improvements, secrets, snapshot/restore workflows, cloud backend, upstream mapper contribution.

### Rollout Summary

```
Phase 1: MVP — native sandboxes, no Docker        ~6–9 commits  (WF1–WF4: up/down/exec/status)
Phase 2: Compose parity — healthchecks, deps, …    +~6 commits (WF1)
Phase 3: Surface expansion — scale, secrets, …     +~8 commits (later)
```

## 8. Cross-Spec Conflicts `PM`

- With `my-app` compose files: profile-gated services (`opencode` profile `agents`; `localstack` profile `storage-s3`) — MVP must respect profiles; `container_name` conventions — sandbox naming derives from project+service, not container_name (open question).

## 9. Reference App Quality Gate `Architect`
N/A — CLI tool, not a reference app (checklist N/A).

## 10. Open Questions `PM`

| # | Question | Options | Impact | Owner | Status |
|---|----------|---------|--------|-------|--------|
| 1 | Distribution & identity: npm name/version, repo `superradcompany/microsandbox-compose`, bin naming (`microsandbox-compose` + maybe alias) | new package | high | PM | open |
| 2 | Sandbox naming convention from compose project+service vs `container_name` | project-service / container_name override | medium | Architect | open |
| 3 | MVP compose-field subset: which fields mapped natively on day one (env_file/healthcheck/depends_on/…) | **DECIDED**: Supported: image, command, env, ports, bind volumes, cpus/memory, profiles; Unsupported: env_file, restart policies, named volumes; healthchecks parsed but unused; depends_on topological only. | high | PM | resolved |
| 4 | Compose `networks` semantics → msb network policy | **DECIDED**: All sandboxes in a project have a single private network with service name resolution; top-level networks configuration ignored. | medium | Architect | resolved |
| 5 | Env interpolation `${VAR:-default}` support | Full compose semantics vs pass-through | medium | Architect | open |
| 6 | Healthcheck gating mechanism (runtime lacks composite health) | app-side probes vs upstream capability | high | Architect | open |
| 7 | dind-based compose (existing msb docs how-to pattern: `msb run … docker:27-dind` + `docker compose` inside) — operator decision | reject | n/a | PM | **DECIDED 2026-10-22: no Docker in sandboxes — 100% without Docker**; dind path rejected.

## Production Readiness `PM`
- Security: no Docker paths at any layer; per-service microVM isolation; secrets via msb secret/env; no privileged host access.
- Observability: CLI-level status/logs surface over msb sandbox handles; no new telemetry in v1.
- Performance: target boot < 100 ms per sandbox after pull; single-command path for typical stack.
- Docs: README (up/down/exec/status), `--help` surface, error-remediation guide.

## Changelog

### 2026-10-22
- App Spec created from brief: new TypeScript CLI `microsandbox-compose` (`npx microsandbox-compose up`) running docker-compose-defined services as native Microsandbox microVMs; no Docker in sandboxes (operator decision, refined to **100% without Docker**).
- **Added networking solution**: All sandboxes in a project share a single private network with service name resolution; top-level networks configuration ignored.
- **Added MVP support scope**: Bind volumes only; `env_file`/`restart`/named volumes unsupported; `depends_on` topological; `healthcheck` parsed but unused.