import type {
  DeviceHandle,
  DeviceSpec,
  ProviderStatus,
  VirtualDeviceProvider,
} from "./types";

abstract class StubProvider implements VirtualDeviceProvider {
  abstract readonly kind: DeviceHandle["provider"];
  async provision(_spec: DeviceSpec): Promise<DeviceHandle> {
    throw new Error(`${this.kind} provider not implemented in MVP`);
  }
  async start(_handle: DeviceHandle): Promise<DeviceHandle> {
    throw new Error(`${this.kind} provider not implemented in MVP`);
  }
  async stop(_handle: DeviceHandle): Promise<DeviceHandle> {
    throw new Error(`${this.kind} provider not implemented in MVP`);
  }
  async restart(_handle: DeviceHandle): Promise<DeviceHandle> {
    throw new Error(`${this.kind} provider not implemented in MVP`);
  }
  async destroy(_handle: DeviceHandle): Promise<void> {
    throw new Error(`${this.kind} provider not implemented in MVP`);
  }
  async getStatus(_handle: DeviceHandle): Promise<ProviderStatus> {
    return "unknown";
  }
  async getMetrics(_handle: DeviceHandle): Promise<Record<string, number>> {
    return {};
  }
}

export class CuttlefishProvider extends StubProvider {
  readonly kind = "cuttlefish" as const;
}

export class WaydroidProvider extends StubProvider {
  readonly kind = "waydroid" as const;
}

export class QemuProvider extends StubProvider {
  readonly kind = "qemu" as const;
}

export type {
  DeviceHandle,
  DeviceSpec,
  ProviderStatus,
  VirtualDeviceProvider,
} from "./types";
export { RedroidProvider } from "./redroid.provider";
export { AdbClient } from "./adb.client";
export { createVirtualDeviceProvider } from "./factory";
