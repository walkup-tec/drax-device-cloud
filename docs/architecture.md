# DRAX Device Cloud — Architecture

Enterprise platform for managing virtual Android devices (Device Farm style), prepared for WhatsApp Business and future integrations.

## Locked decisions

- Own repository (`drax-device-cloud`), not embedded as Nest/Next inside WABA.
- Virtualization behind **Virtual Device Provider** port; MVP implementation = **Redroid**.
- WABA entry: Aquecedor → **Dispositivos** (below Dashboard), production-only, allowlist `mozart.pmo@gmail.com`.
- Redroid workers require Linux + KVM; WABA EasyPanel host only does menu/SSO bridge.

## Microservices (target)

| Service | MVP role |
|---------|----------|
| API (`apps/api`) | Gateway + Auth + Device Manager (modular monolith; split later) |
| ADB Service | Port + client used by Device Manager |
| Streaming / Snapshot / Scheduler / Metrics / Notification / Storage | Stub health apps + contracts reserved |
| Web (`apps/web`) | Next.js device dashboard |

## Provider port

See [ADR-001](adr/001-virtual-device-provider.md).

## SSO from WABA

See [ADR-002](adr/002-waba-sso.md).

## Device states

`CREATING | STARTING | ONLINE | OFFLINE | STOPPING | STOPPED | INSTALLING_APK | RESTORING | ERROR`

## Data plane

PostgreSQL (devices, tenants, users), Redis (leases), RabbitMQ (events), MinIO (snapshots/APK — Beta).

## Horizontal scale

- Stateless API replicas.
- Device ↔ worker affinity via Redis lease `device:{id}:worker`.
- Redroid workers scale by KVM node capacity.

## Observability

Structured Pino logs, OpenTelemetry hooks, Prometheus-ready metrics endpoints on `/metrics`.

## Phases

1. **MVP** — create/list/start/stop/delete + Redroid + WABA menu/SSO
2. **Beta** — snapshots, APK, scheduler, Helm
3. **Enterprise** — WebRTC streaming, multi-provider, autoscaling
