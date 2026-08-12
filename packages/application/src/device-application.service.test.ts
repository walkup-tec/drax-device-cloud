import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DeviceStatus, type CreateDeviceInput, type Device } from "@ddc/domain";
import { InMemoryEventBus } from "@ddc/infra-common";
import { RedroidProvider } from "@ddc/virtual-device-provider";
import { DeviceApplicationService, type DeviceRepository } from "./device-application.service";

class MemRepo implements DeviceRepository {
  private rows = new Map<string, Device>();
  async create(input: CreateDeviceInput & { id: string; status: DeviceStatus }): Promise<Device> {
    const now = new Date().toISOString();
    const row: Device = {
      id: input.id,
      tenantId: input.tenantId,
      ownerId: input.ownerId,
      name: input.name,
      description: input.description || null,
      androidVersion: input.androidVersion || "12",
      brand: input.brand || "Google",
      model: input.model || "Pixel",
      cpu: "4 vCPU",
      ramMb: input.ramMb || 4096,
      storageGb: input.storageGb || 32,
      screenResolution: input.screenResolution || "1080x2400",
      density: input.density || 420,
      language: input.language || "pt-BR",
      timezone: input.timezone || "America/Sao_Paulo",
      gpsJson: {},
      batteryLevel: 100,
      batteryState: "charging",
      status: input.status,
      provider: "redroid",
      providerHandle: {},
      lastBoot: null,
      lastHeartbeat: null,
      tags: input.tags || [],
      metadata: input.metadata || {},
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(row.id, row);
    return row;
  }
  async update(id: string, patch: Partial<Device>): Promise<Device> {
    const cur = this.rows.get(id);
    if (!cur) throw new Error("missing");
    const next = { ...cur, ...patch, updatedAt: new Date().toISOString() };
    this.rows.set(id, next);
    return next;
  }
  async findById(id: string) {
    return this.rows.get(id) || null;
  }
  async listByTenant(tenantId: string) {
    return [...this.rows.values()].filter((d) => d.tenantId === tenantId);
  }
  async delete(id: string) {
    this.rows.delete(id);
  }
}

describe("DeviceApplicationService", () => {
  it("creates device to ONLINE in simulate mode", async () => {
    const bus = new InMemoryEventBus();
    const svc = new DeviceApplicationService(new MemRepo(), new RedroidProvider({ mode: "simulate" }), bus);
    const device = await svc.create({
      tenantId: "t1",
      ownerId: "u1",
      name: "Pixel QA",
    });
    assert.equal(device.status, DeviceStatus.ONLINE);
    assert.ok(bus.events.some((e) => e.routingKey === "DeviceCreated"));
    assert.ok(bus.events.some((e) => e.routingKey === "DeviceStarted"));
    await svc.stop(device.id);
    const stopped = await svc.get(device.id);
    assert.equal(stopped?.status, DeviceStatus.STOPPED);
  });
});
