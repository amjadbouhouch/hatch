# Sandbox Deployment Guide

## Current Architecture (Dev)

- **Dockerfile.sandbox** — Python 3.12 Alpine image with Node.js, data processing libs (pandas, numpy, PDF tools, etc.). Stays alive with `tail -f /dev/null`.
- **DockerSandbox** (`src/services/docker-sandbox.ts`) — Gateway shells out to `docker` CLI directly to create/manage containers per workspace.
- **agent-factory.ts** — Each workspace gets its own container (`hatch-sandbox-${workspaceId}`) with bind mounts from `~/.hatch/workspaces/{id}`.

Works fine locally because the gateway process and Docker daemon share the same host filesystem.

---

## Problems for Staging/Prod

| Issue                        | Detail                                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| **Docker daemon access**     | Gateway calls `docker` CLI directly. If containerized, needs Docker socket (DooD) or DinD.          |
| **Bind mounts use host paths** | `_hostWorkDir` resolves on the Docker host. Breaks if gateway is itself in a container.           |
| **No resource limits**       | No `--memory`, `--cpus`, `--pids-limit`. A user can exhaust the host.                               |
| **No network isolation**     | Sandboxes can reach internal services, databases, metadata endpoints.                               |
| **No image registry**        | `hatch-sandbox` must be pre-built on the host. No automated pull.                                   |
| **Vertical scaling only**    | One host = limited concurrent sandboxes.                                                            |

---

## Staging: Quick Wins

Run the **gateway as a process (not containerized)** on a VM with Docker installed. Avoids DooD/DinD complexity.

### 1. Harden sandbox containers

In `docker-sandbox.ts` → `_buildRunArgs()`, add resource limits and network isolation:

```ts
args.push(
  '--memory', '512m',
  '--cpus', '1',
  '--pids-limit', '256',
  '--network', 'none',
  '--read-only',
  '--tmpfs', '/tmp:size=100m',
  this._image, 'tail', '-f', '/dev/null'
);
```

### 2. Push image to a container registry

Build and push `hatch-sandbox` to ECR/GCR/GHCR so it's available without manual builds:

```bash
docker build -t hatch-sandbox -f Dockerfile.sandbox .
docker tag hatch-sandbox <registry>/hatch-sandbox:latest
docker push <registry>/hatch-sandbox:latest
```

### 3. Pre-pull on deploy

Add a deploy step or startup script that pulls the latest image:

```bash
docker pull <registry>/hatch-sandbox:latest
docker tag <registry>/hatch-sandbox:latest hatch-sandbox
```

---

## Production: Separate Sandbox Service

Extract sandbox management into its own microservice on dedicated host(s):

```
[Gateway Instance]  ──HTTP/gRPC──▶  [Sandbox Service Instance(s)]
   (no Docker needed)                   (Docker daemon + sandbox containers)
```

### Benefits

- **Independent scaling** — add sandbox hosts without touching the gateway.
- **Blast radius isolation** — runaway sandbox can't affect gateway or DB.
- **Simpler gateway deployment** — no Docker dependency.
- **Filesystem** — use volumes or object storage (S3) instead of bind mounts.

### Implementation approach

1. Create a `SandboxService` HTTP API wrapping `DockerSandbox` (endpoints: `POST /create`, `POST /exec`, `DELETE /destroy`).
2. Create a `RemoteSandbox` class implementing `MastraSandbox` that calls the HTTP API instead of shelling out to Docker.
3. Swap `DockerSandbox` for `RemoteSandbox` in `agent-factory.ts` — no changes needed in agent/workspace code thanks to the `MastraSandbox` interface.

### Kubernetes alternative

Replace `DockerSandbox` with a `KubernetesSandbox` that creates pods via the K8s API:

- Resource limits and network policies handled natively.
- Auto-scaling via node pools.
- No Docker socket or DinD required.

---

## Summary

| Environment   | Architecture                                                        | Effort |
| ------------- | ------------------------------------------------------------------- | ------ |
| **Dev**       | Gateway + Docker on same machine (current)                          | Done   |
| **Staging**   | Gateway process + Docker on same VM, hardened containers + registry  | Small  |
| **Production**| Separate Sandbox Service on dedicated hosts, or K8s pods            | Medium |
