# Capability Catalog — Microsandbox Compose (App Spec run)

Source set for the Phase 3 architect checkpoint: Microsandbox platform docs + SDK surface + CLI.

- `microsandbox` CLI (`msb`): `msb run`, `msb create`, `msb exec`, `msb fork`, `msb start`, `msb stop`, `msb restart`, `msb remove`, `msb wait`, `msb logs`, `msb ps`, `msb inspect`, `msb pull`, `msb snapshot`, `msb volume`, `msb image`, `msb jobs`, `msb ping`, `msb touch`, `msb pause`, `msb resume` — source: `crates/cli/` (clap subcommands), README.md.
- Node SDK (`@superradcompany/microsandbox` / `microsandbox`, ESM + napi-rs): `Sandbox.builder(name)` fluent setters — `image`, `rootDisk`, `cpus`, `maxCpus`, `cpuPlacement`, `placementProfile`, `memory`, `maxMemory`, `thp`, `logLevel`, `quietLogs`, `detached`, `ephemeral`, `metricsSampleIntervalMs`, `disableMetricsSample`, `workdir`, `shell`, `security`, `deploymentProfile`, `registry`, `replace`, `replaceWithTimeout`, `entrypoint`, `cmd`, `init`, `initWith`, `hostname`, `libkrunfwPath`, `user`, `pullPolicy`, `disableNetwork`, `interceptTls`, `network`, `proxy`, `port`, `portBind`, `portUdp`, `portUdpBind`, `vsock`, `vsockDgram`, `secret`, `secretEnv`, `env`, `envs`, `label`, `labels`, `rlimit`, `rlimitRange`, `script`, `scripts`, `maxDuration`, `idleTimeout`, `volume`, `addPatch`, `patch`, `build`, `create`, `connectOrCreate`, `createWithPullProgress`, `createWithProgress` — source: `sdk/node-ts/native/index.d.ts`, `sdk/node-ts/src/*`.
- Sandbox lifecycle states: `created | starting | running | draining | paused | stopped | crashed` — source: `sdk/node-ts/src/sandbox-status.ts`.
- Exec: `sandbox.exec(cmd, args)`, `execStream`, `shell`, `execDefault` with `ExecOptionsBuilder` (tty, workdir, user, timeout, stdin); `ExecOutput { code, success, status }` — source: `sdk/node-ts/src/exec.ts`, `crates/cli/lib/commands/exec.rs`.
- Filesystem: bind mounts via `MountBuilder` (`bind`, `named`, `owned`, `tmpfs`, `disk`, `readonly`, `noexec`, `nosuid`, `nodev`, `quota`, `statVirtualization`, `hostPermissions`), copy-in/copy-out, fs ops — source: `sdk/node-ts/native/index.d.ts` (`MountBuilder`), `sdk/node-ts/src/fs.ts`.
- Volumes: named volumes via `Volume.builder(name).create()`, `Volume.get/list/remove`, volume fs — source: `sdk/node-ts/src/volume.ts`.
- Network: `NetworkBuilder` + `NetworkPolicy` (egress/ingress rules, destinations, rate limits, DNS, TLS, proxy) — source: `sdk/node-ts/src/network-config.ts`, `src/policy/*`, `internal/napi.ts`.
- Secrets: `SecretBuilder` / `secretEnv(envVar, value, allowedHost)` — source: `sdk/node-ts/src/registry.ts`, `src/sandbox.ts`.
- Snapshots/fork: `Sandbox.fork(name, ForkOptions)`, `Snapshot`/`RestoreBuilder`, pause/resume — source: `sdk/node-ts/src/snapshot.ts`, `src/snapshot-handle.ts`.
- Docs describing existing compose-related capability: `docs/how-to/ci-cd/compose-tests.mdx` — "Run Docker Compose integration tests" via `msb run -d … docker:27.5.1-dind` + `msb exec … docker compose …` (dind pattern — **rejected for this app** per operator decision; docs-only claim, ungrounded via `om-gap-analysis` since `platform.repo` is not configured in this repo).

## Gaps identified vs. the compose use-case

1. No first-class "compose file → sandboxes" mapping exists in the platform (app-side mapper required).
2. Sandbox lifecycle states have no composite "healthy" concept → app-side readiness strategy needed (Phase 2).
3. No dependency-graph concept for sandboxes → app-side topological start order needed (Phase 2).
4. `env_file` support absent from sandbox config → app-side mapping needed (Phase 2).
5. Interpolate `${VAR:-default}` semantics not first-class in sandbox env → app-side handling (Phase 2).
6. Restart policies not first-class → app-side mapping (Phase 2).
7. Network semantics for compose `networks:` blocks → map to `NetworkBuilder`/`NetworkPolicy` (Phase 3).

## Licensing / tiers

- Microsandbox core (Apache-2.0) — no tier declared in catalog sources read here; leave tier column empty.