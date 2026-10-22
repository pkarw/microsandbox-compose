# Review: what is missing for `docker compose up` compatibility?

Reviewed on 2026-10-22 against the [app spec](../.ai/specs/2026-10-22-app-spec-microsandbox-compose.md). This is a specification review: the repository has no implementation to test.

## Assessment

The spec defines a useful native microVM MVP, but neither the MVP nor its proposed Phase 2 establishes full Docker Compose behavior. A parser that accepts a field is insufficient: startup, connectivity, persistence, signals, and observable outcomes must match.

“100% compliant” needs a pinned Docker Compose release, Compose Specification revision, supported host platforms, and an explicit scope. Docker's implementation also includes optional build, deploy, and development capabilities. Matching `up` does not require implementing every other Compose command, but it does require the model and lifecycle features that `up` consumes. See the [Compose reference](https://docs.docker.com/reference/compose-file/).

## Findings, ordered by impact

### P0 — Explicit networks are silently flattened

**Spec:** §1.3, §1.4, §7; lines 83, 91–93, 101.

Putting every service on one network removes intentional segmentation. For example, a proxy on `frontend` and a database on `backend` must not gain direct connectivity simply because both belong to one project. `internal: true` also controls external access, which is different from a project-private namespace. See the [network reference](https://docs.docker.com/reference/compose-file/networks/).

The shared-network/DNS proposal is also a feasibility blocker: the spec does not identify a working runtime mechanism. The reviewed upstream [NetworkConfig](https://github.com/superradcompany/microsandbox/blob/main/sdk/node-ts/src/network-config.ts) describes policy, DNS configuration, interfaces, and published ports; that alone does not demonstrate project network membership or service discovery. This is an evidence gap, not proof that the runtime cannot support it.

**Required:** validate the topology on a pinned runtime; specify network membership, aliases, cross-project isolation, ingress/egress, and cleanup. Reject unsupported topology before startup rather than silently broadening access.

### P0 — `up` has different lifecycle semantics

**Spec:** WF1, lines 122–135; CLI architecture §3.5.

The proposed command creates detached sandboxes and returns. Docker Compose attaches by default, aggregates logs, and stops services when interrupted. Background operation requires `-d`. Existing services must also be reused or recreated according to configuration/image changes. See [`up`](https://docs.docker.com/reference/cli/docker/compose/up/).

**Required:** define attached/detached operation, stdio and signals, exit codes, graceful shutdown, config/image fingerprints, volume-preserving recreation, and orphan handling. Add project/service ownership labels, durable discovery after a CLI crash, locking, and recovery from partial failure. These are orchestration responsibilities, even when the SDK provides create/stop primitives.

### P1 — Common stacks cannot be represented

**Spec:** §1.3 and §7 explicitly reject `env_file`, `restart`, and named volumes; `build` is absent from the service model.

Local source builds need a Docker-free build path, including context, Dockerfile, arguments, target, secrets, cache, platform, and image/pull precedence. Reading OCI images does not solve building them. See the [build specification](https://docs.docker.com/reference/compose-file/build/).

Named and anonymous volumes need ownership, initialization, persistence across recreation, external-resource handling, and removal rules. Restart policies require supervision that remains active after a detached CLI exits. These need designs, not only mapper setters. See [volumes](https://docs.docker.com/reference/compose-file/volumes/) and [service attributes](https://docs.docker.com/reference/compose-file/services/).

### P1 — Dependency order is insufficient

**Spec:** §1.3, WF1, Phase 2.

Database readiness and one-shot migration completion are different conditions. Long-form `depends_on` needs `service_started`, `service_healthy`, and `service_completed_successfully`, plus applicable `required`/`restart` behavior. Health requires probe execution, inherited image checks, timing, retries, and transitions. See [`depends_on`](https://docs.docker.com/reference/compose-file/services/#depends_on) and [`healthcheck`](https://docs.docker.com/reference/compose-file/services/#healthcheck).

**Required:** specify condition evaluation, failures, timeouts, cycle detection, reverse dependency shutdown, and `--wait`. Waiting for every sandbox to be `running` cannot represent a migration that exits successfully.

### P1 — Configuration loading and environment semantics are incomplete

**Spec:** §1.3–1.4 and §10 Q5.

Missing contracts include discovery of all accepted filenames, parent-directory search, automatic override loading, ordered multiple `-f` inputs, stdin, relative paths, project-name precedence, and Compose environment controls. See the [CLI reference](https://docs.docker.com/reference/cli/docker/compose/).

The loader must define anchors/extensions, `extends`, `include`, and special merge behavior, including reset/override tags. A generic deep merge is insufficient. See [merge rules](https://docs.docker.com/reference/compose-file/merge/) and [include](https://docs.docker.com/reference/compose-file/include/).

Interpolation needs direct, default, required, alternative, nested, and escaped forms across applicable values before merging. A project's interpolation `.env`/`--env-file` is distinct from service-level `env_file`; neither is fully covered by host-only `${VAR:-default}`. See [interpolation](https://docs.docker.com/reference/compose-file/interpolation/) and [variable sources](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/).

### P1 — OCI process semantics are assumed, not specified

**Spec:** image/init glossary and `ComposeService` model, lines 66–67 and 92.

Representing `command` and `entrypoint` only as string arrays loses string, null, and empty override distinctions. Define interaction with image `ENTRYPOINT`/`CMD`, image environment, user, working directory, and stop behavior. Verify official-image initialization with real fixtures; access to an OCI root filesystem alone does not establish process compatibility. See [`command`](https://docs.docker.com/reference/compose-file/services/#command) and [`entrypoint`](https://docs.docker.com/reference/compose-file/services/#entrypoint).

### P1 — The CLI and service-selection contract is incomplete

**Spec:** §3.5 and fixed 1:1 service/sandbox mapping.

Audit every flag in the chosen [`up` baseline](https://docs.docker.com/reference/cli/docker/compose/up/), including build/pull policy, recreation controls, attach selection, abort conditions, selected-service exit codes, timeouts, scale, wait, and watch. The current `--project` name also differs from Compose's `--project-name`/`-p`.

Explicitly targeting a profiled service must follow Compose selection rules; it does not simply start every service with that profile. Include environment-controlled profiles and dependencies. See [profiles](https://docs.docker.com/compose/how-tos/profiles/).

### P2 — Runtime attributes need a complete mapping inventory

**Spec:** §1.4 promises broad ports/mounts/resources without exact field semantics.

Inventory short/long port and mount forms, ephemeral ports, ranges, IPv6, TCP/UDP, read-only mounts, path creation, UID/GID, CPU fractions, memory units/limits, resource reservations, and platform selection. Add configs, file-mounted secrets, metadata, and lifecycle hooks where the baseline supports them. Distinguish Compose secret files from runtime outbound secret substitution. See [services](https://docs.docker.com/reference/compose-file/services/), [configs](https://docs.docker.com/reference/compose-file/configs/), and [secrets](https://docs.docker.com/reference/compose-file/secrets/).

### P2 — Docker-specific equivalence conflicts with the product boundary

The spec permanently forbids Docker sockets, daemons, Docker-in-Docker, and host network namespace sharing. Workloads that depend on those behaviors cannot be fully equivalent under that boundary. Other host integrations, devices, GPUs, and network/volume drivers need platform-specific investigation.

**Required:** publish a compatibility profile with supported, partial, rejected, and intentionally incompatible behavior. A successful supported-subset implementation should not be advertised as universally interchangeable with Docker Compose.

### P2 — No acceptance evidence or credible parity estimate

The spec has user stories but no fixture corpus, pinned runtime, reproducible environment, or compatibility gate. “Known stacks” have no checked-in Compose files or execution results. The ~6-commit Phase 2 estimate omits major behavior above, and the workflow estimates do not reconcile with the ~11-commit handoff total.

**Required:** estimate after runtime spikes and a field/flag inventory. Treat boot-time numbers as unmeasured targets; define hardware, image-cache conditions, stack size, and readiness when benchmarking.

## Proposed acceptance strategy

| Gate | Evidence required |
| --- | --- |
| Runtime feasibility | Two sandboxes communicate by service name; another project cannot resolve/reach them contrary to policy; host publication and teardown work. |
| Model parity | Checked-in fixtures cover discovery, merging, interpolation, validation, profiles, naming, and paths against a pinned reference model. |
| Process parity | Fixtures exercise image defaults and overrides, environment, user/workdir, signals, stdout/stderr, and exit codes. |
| Lifecycle parity | Repeated `up`, changed image/config, interrupted startup, restart after CLI exit, one-shot jobs, recreation, orphans, and persistent data behave as specified. |
| CLI parity | Every baseline `up` flag has a passing behavior case or an explicitly documented incompatibility. |
| Honest failure | Unsupported behavior is reported with file/service/field context before resource creation; runtime failures leave discoverable, recoverable project state. |
| Zero Docker | Production startup/build/runtime paths are verified to avoid Docker processes, sockets, and daemons. |

A Docker Compose reference run may be performed separately to generate comparison fixtures; the shipped implementation must not depend on it. If reference execution is also disallowed, use previously captured expected results and primary documentation.

## Decisions to resolve before implementation

1. Is the goal a practical Compose subset or parity with a named Docker Compose release?
2. What runtime version actually supports the proposed network and DNS topology?
3. Should the MVP preserve Compose's attached default or explicitly document a deliberate difference?
4. Which unsupported fields fail validation, and which are permitted as metadata?
5. How are ownership, persistence, recreation, and a long-lived restart supervisor implemented?

Repository administration note: the requested GitHub destination is `pkarw/microsandbox-compose`. The source spec still names `superradcompany/microsandbox-compose`; its distribution identity should be reconciled before npm publication.
