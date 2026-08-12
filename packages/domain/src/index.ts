export enum DeviceStatus {
  CREATING = "CREATING",
  STARTING = "STARTING",
  ONLINE = "ONLINE",
  OFFLINE = "OFFLINE",
  STOPPING = "STOPPING",
  STOPPED = "STOPPED",
  INSTALLING_APK = "INSTALLING_APK",
  RESTORING = "RESTORING",
  ERROR = "ERROR",
}

export type DeviceProviderKind = "redroid" | "cuttlefish" | "waydroid" | "qemu";

export type Device = {
  id: string;
  tenantId: string;
  ownerId: string;
  name: string;
  description: string | null;
  androidVersion: string;
  brand: string;
  model: string;
  cpu: string;
  ramMb: number;
  storageGb: number;
  screenResolution: string;
  density: number;
  language: string;
  timezone: string;
  gpsJson: Record<string, unknown>;
  batteryLevel: number;
  batteryState: string;
  status: DeviceStatus;
  provider: DeviceProviderKind;
  providerHandle: Record<string, unknown>;
  lastBoot: string | null;
  lastHeartbeat: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CreateDeviceInput = {
  tenantId: string;
  ownerId: string;
  name: string;
  description?: string;
  androidVersion?: string;
  brand?: string;
  model?: string;
  ramMb?: number;
  storageGb?: number;
  screenResolution?: string;
  density?: number;
  language?: string;
  timezone?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
};

export const DEVICE_EVENTS = {
  Created: "DeviceCreated",
  Started: "DeviceStarted",
  Stopped: "DeviceStopped",
  Deleted: "DeviceDeleted",
  Error: "DeviceError",
} as const;
