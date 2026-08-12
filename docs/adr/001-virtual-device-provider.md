# ADR-001 — Virtual Device Provider port

## Status

Accepted

## Context

The platform must support Redroid now and Cuttlefish / Waydroid / QEMU later without rewriting Device Manager.

## Decision

All virtualization goes through `VirtualDeviceProvider`:

- `provision(spec) → DeviceHandle`
- `start` / `stop` / `restart` / `destroy`
- `getStatus` / `getMetrics`

MVP implementation: `RedroidProvider` (Docker).  
Typed stubs: Cuttlefish, Waydroid, QEMU.

Domain and application layers never import Docker/Redroid SDKs.

## Consequences

Provider swaps are config + DI binding changes only.
