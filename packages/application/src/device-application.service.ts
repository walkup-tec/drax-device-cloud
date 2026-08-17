import {
  CreateDeviceInput,
  Device,
  DEVICE_EVENTS,
  DeviceStatus,
} from "@ddc/domain";
import type { EventBus } from "@ddc/infra-common";
import type { DeviceHandle, VirtualDeviceProvider } from "@ddc/virtual-device-provider";

export type DeviceRepository = {
  create(input: CreateDeviceInput & { id: string; status: DeviceStatus }): Promise<Device>;
  update(id: string, patch: Partial<Device>): Promise<Device>;
  findById(id: string): Promise<Device | null>;
  listByTenant(tenantId: string): Promise<Device[]>;
  delete(id: string): Promise<void>;
};

function parseRes(res: string): { width: number; height: number } {
  const m = String(res || "1080x2400").match(/(\d+)\s*[xX]\s*(\d+)/);
  return { width: Number(m?.[1] || 1080), height: Number(m?.[2] || 2400) };
}

export class DeviceApplicationService {
  constructor(
    private readonly repo: DeviceRepository,
    private readonly provider: VirtualDeviceProvider,
    private readonly events: EventBus,
  ) {}

  async create(input: CreateDeviceInput): Promise<Device> {
    const id = cryptoRandomUuid();
    let device = await this.repo.create({
      ...input,
      id,
      status: DeviceStatus.CREATING,
    });

    try {
      const { width, height } = parseRes(device.screenResolution);
      const handle = await this.provider.provision({
        name: device.name,
        androidVersion: device.androidVersion,
        width,
        height,
        dpi: device.density,
        ramMb: device.ramMb,
      });
      device = await this.repo.update(id, {
        providerHandle: handle as unknown as Record<string, unknown>,
        status: DeviceStatus.STARTING,
      });
      await this.provider.start(handle);
      const now = new Date().toISOString();
      device = await this.repo.update(id, {
        status: DeviceStatus.ONLINE,
        lastBoot: now,
        lastHeartbeat: now,
      });
      await this.events.publish(DEVICE_EVENTS.Created, { deviceId: id });
      await this.events.publish(DEVICE_EVENTS.Started, { deviceId: id });
      return device;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      device = await this.repo.update(id, {
        status: DeviceStatus.ERROR,
        metadata: { ...(device.metadata || {}), error: message },
      });
      await this.events.publish(DEVICE_EVENTS.Error, { deviceId: id, message });
      return device;
    }
  }

  list(tenantId: string): Promise<Device[]> {
    return this.repo.listByTenant(tenantId);
  }

  get(id: string): Promise<Device | null> {
    return this.repo.findById(id);
  }

  async start(id: string): Promise<Device> {
    const device = await this.require(id);
    const handle = device.providerHandle as unknown as DeviceHandle;
    await this.repo.update(id, { status: DeviceStatus.STARTING });
    await this.provider.start(handle);
    const now = new Date().toISOString();
    const updated = await this.repo.update(id, {
      status: DeviceStatus.ONLINE,
      lastBoot: now,
      lastHeartbeat: now,
    });
    await this.events.publish(DEVICE_EVENTS.Started, { deviceId: id });
    return updated;
  }

  async stop(id: string): Promise<Device> {
    const device = await this.require(id);
    const handle = device.providerHandle as unknown as DeviceHandle;
    await this.repo.update(id, { status: DeviceStatus.STOPPING });
    await this.provider.stop(handle);
    const updated = await this.repo.update(id, { status: DeviceStatus.STOPPED });
    await this.events.publish(DEVICE_EVENTS.Stopped, { deviceId: id });
    return updated;
  }

  async restart(id: string): Promise<Device> {
    await this.stop(id);
    return this.start(id);
  }

  async remove(id: string): Promise<void> {
    const device = await this.require(id);
    const handle = device.providerHandle as unknown as DeviceHandle;
    try {
      await this.provider.destroy(handle);
    } catch {
      /* continue delete */
    }
    await this.repo.delete(id);
    await this.events.publish(DEVICE_EVENTS.Deleted, { deviceId: id });
  }

  async installApkFromUrl(id: string, apkUrl: string): Promise<Device> {
    const device = await this.require(id);
    const handle = device.providerHandle as unknown as DeviceHandle;
    const provider = this.provider as VirtualDeviceProvider & {
      installApkFromUrl?: (h: DeviceHandle, url: string) => Promise<void>;
    };
    if (!provider.installApkFromUrl) {
      throw new Error("Provider não suporta install APK");
    }
    await this.repo.update(id, { status: DeviceStatus.INSTALLING_APK });
    try {
      await provider.installApkFromUrl(handle, apkUrl);
      return this.repo.update(id, {
        status: DeviceStatus.ONLINE,
        metadata: {
          ...(device.metadata || {}),
          lastApkUrl: apkUrl,
          lastApkAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.repo.update(id, {
        status: DeviceStatus.ERROR,
        metadata: { ...(device.metadata || {}), error: message },
      });
      throw err;
    }
  }

  async screenshot(id: string): Promise<Buffer> {
    const device = await this.require(id);
    const handle = device.providerHandle as unknown as DeviceHandle;
    const provider = this.provider as VirtualDeviceProvider & {
      screenshot?: (h: DeviceHandle) => Promise<Buffer>;
    };
    if (!provider.screenshot) throw new Error("Provider não suporta screenshot");
    return provider.screenshot(handle);
  }

  async launchApp(id: string, packageName: string): Promise<Device> {
    const device = await this.require(id);
    const handle = device.providerHandle as unknown as DeviceHandle;
    const provider = this.provider as VirtualDeviceProvider & {
      launchApp?: (h: DeviceHandle, pkg: string) => Promise<void>;
    };
    if (!provider.launchApp) throw new Error("Provider não suporta launchApp");
    await provider.launchApp(handle, packageName);
    return device;
  }

  async inputTap(id: string, x: number, y: number): Promise<void> {
    const device = await this.require(id);
    const handle = device.providerHandle as unknown as DeviceHandle;
    const provider = this.provider as VirtualDeviceProvider & {
      inputTap?: (h: DeviceHandle, x: number, y: number) => Promise<void>;
    };
    if (!provider.inputTap) throw new Error("Provider não suporta input tap");
    await provider.inputTap(handle, x, y);
  }

  async inputSwipe(
    id: string,
    body: { x1: number; y1: number; x2: number; y2: number; durationMs?: number },
  ): Promise<void> {
    const device = await this.require(id);
    const handle = device.providerHandle as unknown as DeviceHandle;
    const provider = this.provider as VirtualDeviceProvider & {
      inputSwipe?: (h: DeviceHandle, b: typeof body) => Promise<void>;
    };
    if (!provider.inputSwipe) throw new Error("Provider não suporta input swipe");
    await provider.inputSwipe(handle, body);
  }

  async inputText(id: string, text: string): Promise<void> {
    const device = await this.require(id);
    const handle = device.providerHandle as unknown as DeviceHandle;
    const provider = this.provider as VirtualDeviceProvider & {
      inputText?: (h: DeviceHandle, text: string) => Promise<void>;
    };
    if (!provider.inputText) throw new Error("Provider não suporta input text");
    await provider.inputText(handle, text);
  }

  async inputKey(id: string, key: "back" | "home" | "enter"): Promise<void> {
    const device = await this.require(id);
    const handle = device.providerHandle as unknown as DeviceHandle;
    const provider = this.provider as VirtualDeviceProvider & {
      inputKey?: (h: DeviceHandle, key: "back" | "home" | "enter") => Promise<void>;
    };
    if (!provider.inputKey) throw new Error("Provider não suporta input key");
    await provider.inputKey(handle, key);
  }

  async pushFile(id: string, remotePath: string, content: Buffer): Promise<{ remotePath: string }> {
    const device = await this.require(id);
    const handle = device.providerHandle as unknown as DeviceHandle;
    const provider = this.provider as VirtualDeviceProvider & {
      pushFile?: (h: DeviceHandle, remotePath: string, content: Buffer) => Promise<void>;
    };
    if (!provider.pushFile) throw new Error("Provider não suporta push de arquivo");
    await provider.pushFile(handle, remotePath, content);
    return { remotePath };
  }

  private async require(id: string): Promise<Device> {
    const device = await this.repo.findById(id);
    if (!device) throw new Error("Device not found");
    return device;
  }
}

function cryptoRandomUuid(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("crypto").randomUUID();
}
