import { randomUUID } from "crypto";
import type { Pool } from "pg";
import {
  CreateDeviceInput,
  Device,
  DeviceStatus,
} from "@ddc/domain";
import type { DeviceRepository } from "@ddc/application";

export class InMemoryDeviceRepository implements DeviceRepository {
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
    if (!cur) throw new Error("Device not found");
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

export class PgDeviceRepository implements DeviceRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateDeviceInput & { id: string; status: DeviceStatus }): Promise<Device> {
    const id = input.id || randomUUID();
    const { rows } = await this.pool.query(
      `INSERT INTO devices (
        id, tenant_id, owner_id, name, description, android_version, brand, model,
        ram_mb, storage_gb, screen_resolution, density, language, timezone, status, tags, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING *`,
      [
        id,
        input.tenantId,
        input.ownerId,
        input.name,
        input.description || null,
        input.androidVersion || "12",
        input.brand || "Google",
        input.model || "Pixel",
        input.ramMb || 4096,
        input.storageGb || 32,
        input.screenResolution || "1080x2400",
        input.density || 420,
        input.language || "pt-BR",
        input.timezone || "America/Sao_Paulo",
        input.status,
        input.tags || [],
        JSON.stringify(input.metadata || {}),
      ],
    );
    return mapRow(rows[0]);
  }

  async update(id: string, patch: Partial<Device>): Promise<Device> {
    const cur = await this.findById(id);
    if (!cur) throw new Error("Device not found");
    const next = { ...cur, ...patch };
    const { rows } = await this.pool.query(
      `UPDATE devices SET
        name=$2, description=$3, status=$4, provider_handle=$5,
        last_boot=$6, last_heartbeat=$7, metadata=$8, updated_at=now()
       WHERE id=$1 RETURNING *`,
      [
        id,
        next.name,
        next.description,
        next.status,
        JSON.stringify(next.providerHandle || {}),
        next.lastBoot,
        next.lastHeartbeat,
        JSON.stringify(next.metadata || {}),
      ],
    );
    return mapRow(rows[0]);
  }

  async findById(id: string) {
    const { rows } = await this.pool.query(`SELECT * FROM devices WHERE id=$1`, [id]);
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async listByTenant(tenantId: string) {
    const { rows } = await this.pool.query(
      `SELECT * FROM devices WHERE tenant_id=$1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return rows.map(mapRow);
  }

  async delete(id: string) {
    await this.pool.query(`DELETE FROM devices WHERE id=$1`, [id]);
  }
}

function mapRow(row: any): Device {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description,
    androidVersion: row.android_version,
    brand: row.brand,
    model: row.model,
    cpu: row.cpu,
    ramMb: row.ram_mb,
    storageGb: row.storage_gb,
    screenResolution: row.screen_resolution,
    density: row.density,
    language: row.language,
    timezone: row.timezone,
    gpsJson: row.gps_json || {},
    batteryLevel: row.battery_level,
    batteryState: row.battery_state,
    status: row.status,
    provider: row.provider,
    providerHandle: row.provider_handle || {},
    lastBoot: row.last_boot ? new Date(row.last_boot).toISOString() : null,
    lastHeartbeat: row.last_heartbeat ? new Date(row.last_heartbeat).toISOString() : null,
    tags: row.tags || [],
    metadata: row.metadata || {},
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
