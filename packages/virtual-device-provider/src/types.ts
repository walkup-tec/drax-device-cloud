export type DeviceSpec = {
  name: string;
  androidVersion: string;
  width: number;
  height: number;
  dpi: number;
  ramMb: number;
};

export type DeviceHandle = {
  provider: "redroid" | "cuttlefish" | "waydroid" | "qemu";
  containerId?: string;
  adbSerial?: string;
  simulated?: boolean;
  meta?: Record<string, unknown>;
};

export type ProviderStatus = "running" | "stopped" | "unknown" | "error";

export interface VirtualDeviceProvider {
  readonly kind: DeviceHandle["provider"];
  provision(spec: DeviceSpec): Promise<DeviceHandle>;
  start(handle: DeviceHandle): Promise<DeviceHandle>;
  stop(handle: DeviceHandle): Promise<DeviceHandle>;
  restart(handle: DeviceHandle): Promise<DeviceHandle>;
  destroy(handle: DeviceHandle): Promise<void>;
  getStatus(handle: DeviceHandle): Promise<ProviderStatus>;
  getMetrics(handle: DeviceHandle): Promise<Record<string, number>>;
}
