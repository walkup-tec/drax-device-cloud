import { Injectable, OnModuleInit } from "@nestjs/common";
import { DeviceApplicationService, type DeviceRepository } from "@ddc/application";
import { createRabbitEventBus, createLogger } from "@ddc/infra-common";
import { createVirtualDeviceProvider } from "@ddc/virtual-device-provider";
import { InMemoryDeviceRepository, PgDeviceRepository } from "./device.repository";

@Injectable()
export class DevicesService implements OnModuleInit {
  private app!: DeviceApplicationService;
  private readonly logger = createLogger("devices");

  async onModuleInit() {
    const events = await createRabbitEventBus(process.env.RABBITMQ_URL);
    const provider = createVirtualDeviceProvider("redroid");
    let repo: DeviceRepository = new InMemoryDeviceRepository();
    if (process.env.DATABASE_URL) {
      try {
        const { Pool } = await import("pg");
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        await pool.query("SELECT 1");
        repo = new PgDeviceRepository(pool);
        this.logger.info("Using PostgreSQL device repository");
      } catch (err) {
        this.logger.warn({ err }, "Postgres unavailable — using in-memory repository");
      }
    } else {
      this.logger.info("DATABASE_URL unset — using in-memory repository");
    }
    this.app = new DeviceApplicationService(repo, provider, events);
  }

  create(input: {
    tenantId: string;
    ownerId: string;
    name: string;
    description?: string;
  }) {
    return this.app.create(input);
  }

  list(tenantId: string) {
    return this.app.list(tenantId);
  }

  get(id: string) {
    return this.app.get(id);
  }

  start(id: string) {
    return this.app.start(id);
  }

  stop(id: string) {
    return this.app.stop(id);
  }

  restart(id: string) {
    return this.app.restart(id);
  }

  remove(id: string) {
    return this.app.remove(id);
  }

  installApkFromUrl(id: string, apkUrl: string) {
    return this.app.installApkFromUrl(id, apkUrl);
  }

  screenshot(id: string) {
    return this.app.screenshot(id);
  }

  launchApp(id: string, packageName: string) {
    return this.app.launchApp(id, packageName);
  }

  inputTap(id: string, x: number, y: number) {
    return this.app.inputTap(id, x, y);
  }

  inputSwipe(
    id: string,
    body: { x1: number; y1: number; x2: number; y2: number; durationMs?: number },
  ) {
    return this.app.inputSwipe(id, body);
  }

  inputText(id: string, text: string) {
    return this.app.inputText(id, text);
  }

  inputKey(id: string, key: "back" | "home" | "enter") {
    return this.app.inputKey(id, key);
  }

  pushFile(id: string, remotePath: string, content: Buffer) {
    return this.app.pushFile(id, remotePath, content);
  }
}
