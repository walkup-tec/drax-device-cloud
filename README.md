# DRAX Device Cloud

SaaS platform for virtual Android device management (Enterprise Device Farm).

## Quick start

```bash
cp .env.example .env
docker compose -f infra/docker-compose.yml up -d postgres redis rabbitmq minio
npm install
npm run build
npm run start:api
npm run start:web
```

Redroid worker (Linux + KVM only):

```bash
docker compose -f infra/redroid/docker-compose.yml up -d
```

Set `REDROID_MODE=docker` on a KVM host, or `REDROID_MODE=simulate` for local API/UI without KVM.

## Docs

- [Architecture](docs/architecture.md)
- [ADR-001 Provider](docs/adr/001-virtual-device-provider.md)
- [ADR-002 WABA SSO](docs/adr/002-waba-sso.md)

## Workspace

- `apps/api` — NestJS modular API (gateway + auth + devices)
- `apps/web` — Next.js dashboard
- `packages/*` — domain, application, provider, infra-common, contracts
- Stub services under `apps/*-service` (health placeholders)
