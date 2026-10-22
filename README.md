<div align="center">

# Microsandbox Compose

**Your Compose stack. One microVM per service. Zero Docker.**

Run Compose-defined workloads with the hardware isolation of [Microsandbox](https://github.com/superradcompany/microsandbox).

[![Status: specification](https://img.shields.io/badge/status-specification-blue)](.ai/specs/2026-10-22-app-spec-microsandbox-compose.md)
[![Planned CLI: TypeScript](https://img.shields.io/badge/planned_CLI-TypeScript-3178C6)](#architecture)
[![Runtime: Microsandbox](https://img.shields.io/badge/runtime-Microsandbox-6E56CF)](https://github.com/superradcompany/microsandbox)

[The idea](#the-idea) · [Planned usage](#planned-usage) · [Compatibility](#compose-compatibility) · [Roadmap](#roadmap) · [Specification](.ai/specs/2026-10-22-app-spec-microsandbox-compose.md)

</div>

> **Project status:** specification stage. This repository contains the product spec and a compatibility review. There is no CLI implementation, installable release, or verified runtime integration yet. Commands below describe the intended interface.

## The idea

Compose is a convenient way to describe a stack. Microsandbox Compose aims to keep that workflow while running each service in its own native microVM through Microsandbox.

```text
                         microsandbox-compose
compose.yaml ──────────► parse → validate → map → orchestrate
                                                   │
                          ┌────────────────────────┼────────────────────────┐
                          ▼                        ▼                        ▼
                    ┌───────────┐            ┌───────────┐            ┌───────────┐
                    │    app    │            │   cache   │            │    db     │
                    │  microVM  │            │  microVM  │            │  microVM  │
                    └───────────┘            └───────────┘            └───────────┘
                          └──────── project network + service DNS ──────────┘
                                      planned; needs validation
```

The primary use case is local development and AI-agent workloads that benefit from a separate guest kernel for each service. OCI images remain the input; execution uses the Microsandbox runtime directly, with no Docker daemon, socket, or Docker-in-Docker layer.

## Planned usage

Start with a small `compose.yaml`:

```yaml
name: isolated-stack

services:
  web:
    image: nginx:alpine
    ports:
      - "127.0.0.1:8080:80"

  cache:
    image: redis:7-alpine
    command: ["redis-server", "--save", "", "--appendonly", "no"]
```

Once a release exists, the intended workflow is:

```sh
npx microsandbox-compose up
npx microsandbox-compose status
npx microsandbox-compose exec cache -- redis-cli ping
npx microsandbox-compose down
```

The example is illustrative and has not been tested against Microsandbox. The current spec proposes background startup by default; matching Compose's attached startup and `-d` behavior is an open compatibility gap.

### Planned commands

| Command | Intended behavior |
| --- | --- |
| `up [service]` | Start selected services and their dependencies as native sandboxes. |
| `down` | Stop and remove the project's managed sandboxes. |
| `exec <service> -- <command> [args...]` | Execute a command inside a running service sandbox. |
| `status` | List services, sandbox identities, images, ports, and runtime states. |

Planned options include `--file`, `--project`, `--profile`, and `--json`. Exact flag names, aliases, defaults, and exit behavior still need to be finalized.

## Compose compatibility

**The MVP targets a Compose subset. Full `docker compose up` compatibility is a separate engineering goal.** Nothing in the table below is implemented yet.

| Area | Current specification |
| --- | --- |
| OCI images | Planned; image metadata and startup semantics need verification. |
| `command` / `entrypoint` | Planned; inheritance, string/list forms, and empty overrides need definition. |
| `environment` | Planned with host-variable `${VAR:-default}` interpolation; full precedence and syntax are missing. |
| Ports | Planned host-to-guest publication; complete short/long syntax and protocol behavior need definition. |
| Bind mounts | Planned; ownership, access modes, and path semantics need validation. |
| CPU / memory | Planned; exact Compose keys and enforcement behavior need definition. |
| Profiles | Planned; explicit service targeting and dependency rules need definition. |
| `depends_on` | Startup order only; readiness and successful-completion conditions are deferred. |
| Healthchecks | Parsed but unused in the MVP. |
| Networking | One shared project network with service DNS is proposed; runtime feasibility is unverified. Explicit network settings are currently specified as ignored. |
| `env_file`, `restart`, named volumes | Explicitly rejected in the MVP. |
| `build`, secrets, configs, scaling, watch | Outside the defined MVP. |
| Reconciliation and CLI parity | Repeated `up`, changed configurations, signals, attach behavior, and many flags remain unspecified. |

The [compatibility review](docs/compose-compatibility-review.md) explains the blockers, missing behaviors, and an acceptance strategy. Its recommendation is to reject unsupported behavior before creating resources, particularly configuration that affects isolation or persistence. That recommendation has not yet been incorporated into the source spec.

## Architecture

The proposed CLI is a Node.js / TypeScript package with four layers:

| Layer | Responsibility |
| --- | --- |
| `compose-spec` | Load, normalize, and validate the supported Compose model. |
| `mapper` | Translate each service into a Microsandbox configuration. |
| `lifecycle` | Manage project ownership, dependencies, startup, teardown, and reconciliation. |
| `cli` | Parse commands, render output, connect stdio, and return exit codes. |

The execution backend is the native Microsandbox runtime. A supported runtime version, Node.js version, host OS/architecture matrix, and installation procedure will be established during implementation.

## Roadmap

1. **Validate the foundations.** Prove cross-sandbox networking and DNS, OCI startup behavior, bind mounts, and project lifecycle on a pinned Microsandbox release.
2. **Ship the supported subset.** Implement `up`, `down`, `exec`, and `status`, with explicit validation and end-to-end fixtures.
3. **Support everyday stacks.** Add environment files, readiness and completion dependencies, restart supervision, and persistent named volumes.
4. **Expand compatibility.** Address builds, network topology, configs and secrets, scaling, reconciliation, and the remaining `up` options against a pinned Compose baseline.

Full behavioral equivalence needs a defined platform scope and explicit exceptions for Docker-specific integrations that conflict with the zero-Docker requirement.

## Contributing

Start with the [app specification](.ai/specs/2026-10-22-app-spec-microsandbox-compose.md) and [compatibility review](docs/compose-compatibility-review.md). Useful contributions include minimal Compose fixtures, runtime feasibility results, and concrete proposals for unresolved semantics.

There are no build or test commands yet. Performance numbers in the spec are targets, not benchmark results. A license has not yet been selected for this repository.

## Related projects

- [Microsandbox](https://github.com/superradcompany/microsandbox) — the proposed native microVM backend.
- [Compose Specification](https://github.com/compose-spec/compose-spec) — the portable application model.
- [Docker Compose `up` reference](https://docs.docker.com/reference/cli/docker/compose/up/) — the behavioral reference for the compatibility review.

Microsandbox Compose is an independent project; this repository does not imply affiliation with the upstream projects.
