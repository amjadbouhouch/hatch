# @hatch/sandbox-service

Lightweight HTTP service that wraps `DockerSandbox` for remote container management. Runs on a Docker host and exposes a REST API so the gateway can manage sandbox containers over the network.

## Architecture

```
┌─ Gateway (any host) ─────────────┐     ┌─ Sandbox Service (Docker host) ──┐
│                                   │     │                                   │
│  RemoteSandbox ──── fetch() ─────────▶  │  Hono HTTP ──▶ DockerSandbox     │
│  (MastraSandbox)                  │     │                  (docker CLI)     │
│                                   │     │                    │              │
└───────────────────────────────────┘     │              ┌─────▼─────┐       │
                                          │              │ Sandbox   │       │
                                          │              │ Container │       │
                                          │              └───────────┘       │
                                          └───────────────────────────────────┘
```

In **dev mode**, the gateway uses `DockerSandbox` directly (no sandbox-service needed). In **production**, set `SANDBOX_SERVICE_URL` and the gateway switches to `RemoteSandbox` which proxies all calls to this service.

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/sandboxes` | Create & start a sandbox container |
| `GET` | `/sandboxes/:id` | Get sandbox info/status |
| `POST` | `/sandboxes/:id/exec` | Execute a command in the sandbox |
| `POST` | `/sandboxes/:id/mount` | Mount a host path into the sandbox |
| `DELETE` | `/sandboxes/:id` | Destroy a sandbox container |

### POST /sandboxes

Creates a new sandbox container. Body accepts `DockerSandboxOptions`:

```json
{
  "id": "workspace-uuid",
  "image": "hatch-sandbox",
  "containerName": "hatch-sandbox-workspace-uuid",
  "resourceLimits": {
    "memory": "512m",
    "cpus": "1",
    "pidsLimit": 256,
    "tmpfsSize": "100m"
  },
  "networkOptions": { "network": "bridge" },
  "readOnly": true
}
```

### POST /sandboxes/:id/exec

Executes a command and returns the result when complete:

```json
{
  "command": "python script.py",
  "args": [],
  "options": {
    "timeout": 30000,
    "cwd": "/workspace/projects",
    "env": { "MY_VAR": "value" }
  }
}
```

Response:

```json
{
  "success": true,
  "exitCode": 0,
  "stdout": "Hello world\n",
  "stderr": "",
  "executionTimeMs": 142,
  "timedOut": false,
  "killed": false,
  "command": "python script.py"
}
```

### POST /sandboxes/:id/mount

Mounts a host directory into the sandbox container (triggers container recreation):

```json
{
  "hostPath": "/data/workspaces/abc123",
  "mountPath": "/workspace"
}
```

## Running

### Development

```bash
cd apps/sandbox-service
bun run dev    # http://localhost:3100
```

### Production

```bash
# Build
bun run build

# Run on a Docker host (Docker daemon must be accessible)
SANDBOX_SERVICE_PORT=3100 node dist/index.js
```

### Gateway configuration

```bash
# Dev: no env var needed, gateway uses DockerSandbox directly

# Production: point gateway to this service
SANDBOX_SERVICE_URL=http://sandbox-host:3100
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SANDBOX_SERVICE_PORT` | `3100` | Port the service listens on |

## Deployment

This service must run on a host with:

1. **Docker daemon** running and accessible
2. **`docker` CLI** installed
3. **`hatch-sandbox` image** built or pulled

```bash
# Build the sandbox image on the Docker host
docker build -t hatch-sandbox -f ../gateway/Dockerfile.sandbox .

# Or pull from a registry
docker pull <registry>/hatch-sandbox:latest
docker tag <registry>/hatch-sandbox:latest hatch-sandbox
```

### Graceful shutdown

On `SIGINT`/`SIGTERM`, the service destroys all active sandbox containers before exiting to prevent orphaned Docker containers.
