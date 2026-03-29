# Sandbox Deployment Guide

## Architecture Overview

Hatch uses isolated Docker containers as sandboxes for agent code execution. The sandbox system has two modes controlled by a single environment variable:

```
┌─ Dev Mode (default) ──────────────────────────────────────────────────────┐
│                                                                           │
│  Gateway ──▶ DockerSandbox ──▶ docker CLI ──▶ Sandbox Containers          │
│  (same host, direct access)                                               │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘

┌─ Production Mode (SANDBOX_SERVICE_URL set) ───────────────────────────────┐
│                                                                           │
│  Gateway ──▶ RemoteSandbox ──── HTTP ────▶ Sandbox Service ──▶ Docker     │
│  (any host)                                (Docker host)                  │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

Both modes use the same `MastraSandbox` interface — zero changes to agent, workspace, or tool code.

## Components

| Component | Location | Deploys to |
|-----------|----------|------------|
| **DockerSandbox** | `apps/gateway/src/services/docker-sandbox.ts` | Gateway (dev) or Sandbox Service (prod) |
| **RemoteSandbox** | `apps/gateway/src/services/remote-sandbox.ts` | Gateway (prod only) |
| **Sandbox Service** | `apps/sandbox-service/` | Docker host (prod only) |
| **Sandbox Image** | `apps/gateway/Dockerfile.sandbox` | Docker host |

## Sandbox Image

Python 3.12 Alpine with Node.js, data processing libs (pandas, numpy, PDF tools, etc.):

```bash
docker build -t hatch-sandbox -f apps/gateway/Dockerfile.sandbox .
```

Each workspace gets its own container (`hatch-sandbox-${workspaceId}`) with:
- Resource limits: 512MB RAM, 1 CPU, 256 PIDs (configurable)
- Read-only filesystem with writable `/tmp`
- Configurable network isolation
- Bind mounts from `~/.hatch/workspaces/{id}`

---

## Dev Mode

Gateway and Docker daemon on the same machine. No extra setup needed.

```bash
bun run dev:gateway
```

The gateway uses `DockerSandbox` directly — shells out to `docker` CLI to create/manage containers.

---

## Production Mode

The gateway runs separately from the Docker host. The Sandbox Service handles container management over HTTP.

### 1. Deploy Sandbox Service on Docker host

```bash
# Build
cd apps/sandbox-service && bun run build

# Run (Docker daemon must be accessible on this host)
SANDBOX_SERVICE_PORT=3100 node dist/index.js
```

Ensure the `hatch-sandbox` image is available:

```bash
# Build locally
docker build -t hatch-sandbox -f apps/gateway/Dockerfile.sandbox .

# Or pull from registry
docker pull <registry>/hatch-sandbox:latest
docker tag <registry>/hatch-sandbox:latest hatch-sandbox
```

### 2. Point Gateway to Sandbox Service

```bash
SANDBOX_SERVICE_URL=http://sandbox-host:3100
```

That's it. The gateway detects the env var and switches from `DockerSandbox` to `RemoteSandbox`.

### Production topology

```
┌─ Host A ──────────────────┐     ┌─ Host B (Docker host) ──────────┐
│                            │     │                                  │
│  Gateway                   │     │  Sandbox Service (:3100)         │
│  (container or process)    │────▶│    ├── DockerSandbox             │
│                            │     │    ├── sandbox-ws-001            │
│  No Docker needed          │     │    ├── sandbox-ws-002            │
│                            │     │    └── sandbox-ws-003            │
└────────────────────────────┘     └──────────────────────────────────┘
```

---

## Sandbox Service API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/sandboxes` | Create & start sandbox |
| `GET` | `/sandboxes/:id` | Get sandbox info |
| `POST` | `/sandboxes/:id/exec` | Execute command |
| `POST` | `/sandboxes/:id/mount` | Mount host path |
| `DELETE` | `/sandboxes/:id` | Destroy sandbox |

See [`apps/sandbox-service/README.md`](../../apps/sandbox-service/README.md) for full API docs.

---

## Environment Variables

### Gateway

| Variable | Default | Description |
|----------|---------|-------------|
| `SANDBOX_SERVICE_URL` | *(unset)* | Set to enable remote mode (e.g. `http://sandbox-host:3100`) |
| `SANDBOX_MEMORY` | `512m` | Container memory limit |
| `SANDBOX_CPUS` | `1` | Container CPU limit |
| `SANDBOX_PIDS_LIMIT` | `256` | Max PIDs inside container |
| `SANDBOX_TMPFS_SIZE` | `100m` | Writable `/tmp` size |
| `SANDBOX_NETWORK` | `bridge` | Docker network mode |
| `SANDBOX_READ_ONLY` | `true` | Read-only container filesystem |

### Sandbox Service

| Variable | Default | Description |
|----------|---------|-------------|
| `SANDBOX_SERVICE_PORT` | `3100` | Port the service listens on |

---

## Scaling

### Adding more sandbox capacity

Deploy additional Sandbox Service instances on separate Docker hosts. Use a load balancer or assign workspaces to specific hosts:

```
Gateway ──▶ Load Balancer ──▶ Sandbox Service (Host B)
                           ──▶ Sandbox Service (Host C)
                           ──▶ Sandbox Service (Host D)
```

### Kubernetes alternative

Replace `DockerSandbox` with a `KubernetesSandbox` that creates pods via the K8s API:

- Resource limits and network policies handled natively
- Auto-scaling via node pools
- No Docker socket or DinD required
- Same `MastraSandbox` interface — drop-in replacement

---

## Summary

| Environment | How it works | Setup |
|-------------|-------------|-------|
| **Dev** | Gateway uses `DockerSandbox` directly | None (default) |
| **Production** | Gateway uses `RemoteSandbox` → Sandbox Service → Docker | Set `SANDBOX_SERVICE_URL` |
