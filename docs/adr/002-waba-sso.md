# ADR-002 — WABA SSO bridge

## Status

Accepted

## Context

Device Cloud UI must open from WABA Aquecedor → Dispositivos only for `mozart.pmo@gmail.com` in production.

## Decision

- WABA exposes `POST /device-cloud/sso` (allowlisted email + production profile).
- Issues a short-lived HS256 JWT signed with `DEVICE_CLOUD_SSO_SECRET`.
- Claims: `sub` (email), `tenant`, `aud=drax-device-cloud`, `exp` ≤ 5 minutes.
- Device Cloud `/auth/sso` exchanges it for access + refresh tokens.
- Menu registry item `dispositivos` uses `profile: production` and client-side/server allowlist.

## Consequences

V02/V03 never show the menu. Other production users never receive SSO tokens.
