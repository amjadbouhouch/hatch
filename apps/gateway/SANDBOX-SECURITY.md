# Sandbox Security

Security analysis of the sandbox system (DockerSandbox, RemoteSandbox, Sandbox Service).

---

## Current Mitigations (already in place)

| Control | Implementation |
|---------|---------------|
| Read-only filesystem | `--read-only` flag on all sandbox containers |
| Memory limit | `--memory 512m` (configurable via `SANDBOX_MEMORY`) |
| CPU limit | `--cpus 1` (configurable via `SANDBOX_CPUS`) |
| PID limit | `--pids-limit 256` (configurable via `SANDBOX_PIDS_LIMIT`) |
| Tmpfs-only `/tmp` | `--tmpfs /tmp:size=100m` — no persistent writes outside mounts |
| Configurable network | `--network none` or `bridge` (configurable via `SANDBOX_NETWORK`) |
| Graceful shutdown | Sandbox Service destroys all containers on `SIGINT`/`SIGTERM` |
| Per-workspace isolation | Each workspace gets its own container — no shared state |

---

## P0 — Must fix before staging

### 1. No authentication on Sandbox Service API

**Risk:** Anyone who can reach the sandbox-service port can create containers, execute arbitrary commands, mount host paths, and destroy sandboxes.

**Impact:** Critical — full remote code execution on the Docker host.

**Recommendation:** Add a shared secret between gateway and sandbox-service. The gateway sends it as `Authorization: Bearer <token>`, the service rejects requests without it.

```
SANDBOX_SERVICE_TOKEN=<random-secret>
```

Implementation: Hono middleware on all `/sandboxes/*` routes (~20 lines).

---

### 2. Mount endpoint accepts arbitrary host paths

**Risk:** The `POST /sandboxes/:id/mount` endpoint takes a `hostPath` directly from the request body with no validation. A malicious or buggy request could mount sensitive host directories:

```json
{ "hostPath": "/etc", "mountPath": "/workspace" }
{ "hostPath": "/root/.ssh", "mountPath": "/workspace/keys" }
{ "hostPath": "/var/run/docker.sock", "mountPath": "/workspace/sock" }
```

**Impact:** Critical — read/write access to any host path, including Docker socket (container escape to root).

**Recommendation:** Allowlist of permitted base paths. Only paths under `HATCH_HOME` (default `~/.hatch`) should be mountable. Reject everything else. Also reject symlinks that resolve outside the allowlist.

```typescript
const allowed = [process.env.HATCH_HOME ?? join(homedir(), '.hatch')];
if (!allowed.some(base => realpath(hostPath).startsWith(base))) {
  return c.json({ error: 'Path not allowed' }, 403);
}
```

Implementation: ~10 lines of validation in the mount route.

---

## P1 — Should fix before production

### 3. Missing Linux capabilities hardening

**Risk:** Sandbox containers run with Docker's default Linux capabilities, which include `CAP_CHOWN`, `CAP_DAC_OVERRIDE`, `CAP_FOWNER`, `CAP_NET_RAW`, and others. These are unnecessary for code execution and widen the attack surface for container escapes.

**Impact:** Medium — aids privilege escalation if a kernel vulnerability is exploited.

**Recommendation:** Drop all capabilities and prevent privilege escalation:

```typescript
// In _buildRunArgs()
args.push(
  '--cap-drop=ALL',
  '--security-opt=no-new-privileges',
);
```

Two lines in `docker-sandbox.ts`. No functional impact on Python/Node.js code execution.

---

### 4. No TLS between gateway and sandbox-service

**Risk:** HTTP traffic between gateway and sandbox-service is plaintext. Commands, stdout/stderr output, file paths, and environment variables (which may contain API keys passed to sandbox commands) are visible to anyone on the network path.

**Impact:** Medium — data exposure via network sniffing. Irrelevant for localhost/same-host dev, significant for cross-host production.

**Recommendation:** One of:
- **TLS termination** — reverse proxy (nginx/caddy) with TLS in front of the sandbox-service
- **Private network** — run both on an isolated VPC/VLAN with no public exposure
- **mTLS** — mutual TLS for both authentication and encryption (replaces the shared secret in P0.1)

---

### 5. Network isolation not enforced by default

**Risk:** The default `SANDBOX_NETWORK` in `agent-factory.ts` is `bridge`, which gives sandbox containers access to:
- The host network (other services, databases)
- Cloud metadata endpoints (e.g., `169.254.169.254` on AWS/GCP — credential theft)
- Other sandbox containers

**Impact:** Medium — lateral movement, credential theft from metadata service, data exfiltration.

**Recommendation:**
- Default to `none` for sandboxes that don't need network access
- For sandboxes that need network: use a dedicated Docker network with no access to the host or metadata endpoints
- Block metadata endpoint explicitly:

```bash
iptables -I DOCKER-USER -d 169.254.169.254 -j DROP
```

---

## P2 — Should fix for hardened production

### 6. No rate limiting on command execution

**Risk:** A compromised gateway or runaway agent loop can spam `POST /sandboxes/:id/exec` and exhaust Docker host resources (CPU, memory, disk I/O) even with per-container limits in place.

**Impact:** Low-Medium — denial of service on the sandbox host.

**Recommendation:**
- Per-sandbox concurrency limit (e.g., max 3 concurrent exec calls per sandbox)
- Global rate limit on the sandbox-service (e.g., 100 exec/min across all sandboxes)
- Request timeout on the Hono server to prevent hung connections

Implementation: ~30 lines using a simple in-memory counter or Hono rate-limit middleware.

---

### 7. No sandbox lifetime limit (TTL)

**Risk:** Sandboxes run indefinitely if the gateway crashes without calling destroy. Orphaned containers accumulate, consuming memory and PIDs on the Docker host.

**Impact:** Low-Medium — resource exhaustion over time.

**Recommendation:**
- **TTL per sandbox** — auto-destroy after N minutes of inactivity (no exec calls). Default: 30 minutes.
- **Reaper cron** — periodic sweep in the sandbox-service that destroys sandboxes idle beyond TTL.
- **Max sandboxes limit** — reject creation when a configurable max (e.g., 50) is reached.

Implementation: ~50 lines — timestamp tracking on last exec + setInterval reaper.

---

### 8. No audit logging

**Risk:** No record of which sandboxes were created, what commands were executed, or who destroyed what. Makes incident investigation impossible.

**Impact:** Low — operational visibility, not a direct vulnerability.

**Recommendation:** Structured JSON logs for all sandbox operations:

```json
{"event":"sandbox.create","id":"ws-abc","image":"hatch-sandbox","timestamp":"..."}
{"event":"sandbox.exec","id":"ws-abc","command":"python x.py","exitCode":0,"ms":142}
{"event":"sandbox.destroy","id":"ws-abc","reason":"api_call"}
```

---

## P3 — Defense in depth

### 9. Container runtime isolation (gVisor / Kata)

**Risk:** Standard Docker containers share the host kernel. A kernel exploit from inside a container = full host compromise. This is the fundamental limitation of container-based isolation.

**Impact:** Low probability, critical impact.

**Recommendation:** For multi-tenant production, use a stronger isolation runtime:
- **gVisor** (`runsc`) — user-space kernel, intercepts syscalls. ~5-10% performance overhead.
- **Kata Containers** — lightweight VMs per container. Stronger isolation, higher overhead.

Configuration:

```bash
# Install gVisor, then:
docker run --runtime=runsc ...

# Or in DockerSandboxOptions:
extraRunArgs: ['--runtime=runsc']
```

---

### 10. Seccomp and AppArmor profiles

**Risk:** Sandbox containers can make any Linux syscall that Docker's default seccomp profile allows (~300+ syscalls). Many are unnecessary for Python/Node.js workloads.

**Recommendation:** Custom seccomp profile that allows only the syscalls needed for Python + Node.js execution. Docker's default profile is a reasonable baseline, but a tighter custom profile reduces attack surface further.

```bash
docker run --security-opt seccomp=hatch-sandbox-seccomp.json ...
```

---

### 11. Image supply chain

**Risk:** The `hatch-sandbox` image is built from `python:3.12-alpine` and installs packages via `apk` and `pip`. A compromised base image or package = compromised sandbox.

**Recommendation:**
- Pin image digests, not tags (`python:3.12-alpine@sha256:...`)
- Pin pip package versions (`numpy==2.1.0`, not `numpy`)
- Scan image with Trivy/Grype before deploy
- Rebuild on a schedule to pick up security patches

---

## Summary

```
P0 (before staging)     P1 (before production)    P2 (hardened prod)       P3 (defense in depth)
─────────────────────   ───────────────────────    ────────────────────     ─────────────────────
Auth on service API     Drop all capabilities      Rate limiting            gVisor / Kata runtime
Allowlist mount paths   TLS / private network      Sandbox TTL / reaper     Seccomp profiles
                        Network isolation           Max sandbox limit        Image supply chain
                                                    Audit logging
```
