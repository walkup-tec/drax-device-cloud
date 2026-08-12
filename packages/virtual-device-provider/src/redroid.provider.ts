import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import type {
  DeviceHandle,
  DeviceSpec,
  ProviderStatus,
  VirtualDeviceProvider,
} from "./types";

const execFileAsync = promisify(execFile);

export type RedroidProviderOptions = {
  mode: "simulate" | "docker";
  image?: string;
  dockerBin?: string;
};

/**
 * Redroid Virtual Device Provider.
 * - simulate: no Docker/KVM required (local/dev)
 * - docker: `docker run` privileged Redroid (Linux + /dev/kvm)
 */
export class RedroidProvider implements VirtualDeviceProvider {
  readonly kind = "redroid" as const;
  private readonly mode: "simulate" | "docker";
  private readonly image: string;
  private readonly dockerBin: string;
  private readonly simulated = new Map<string, ProviderStatus>();

  constructor(opts?: RedroidProviderOptions) {
    this.mode = opts?.mode === "docker" ? "docker" : "simulate";
    this.image = opts?.image || process.env.REDROID_IMAGE || "redroid/redroid:12.0.0-latest";
    this.dockerBin = opts?.dockerBin || "docker";
  }

  async provision(spec: DeviceSpec): Promise<DeviceHandle> {
    if (this.mode === "simulate") {
      const id = `sim-${randomUUID()}`;
      this.simulated.set(id, "stopped");
      return {
        provider: "redroid",
        containerId: id,
        adbSerial: `emulator-${id.slice(0, 8)}`,
        simulated: true,
        meta: { name: spec.name, androidVersion: spec.androidVersion },
      };
    }

    const name = `ddc-redroid-${randomUUID().slice(0, 8)}`;
    const [width, height] = parseResolution(spec);
    const args = [
      "run",
      "-d",
      "--privileged",
      "--name",
      name,
      "-p",
      "5555",
      this.image,
      `androidboot.redroid_width=${width}`,
      `androidboot.redroid_height=${height}`,
      `androidboot.redroid_dpi=${spec.dpi}`,
    ];
    const { stdout } = await execFileAsync(this.dockerBin, args, { timeout: 120_000 });
    const containerId = String(stdout || "").trim() || name;
    return {
      provider: "redroid",
      containerId,
      adbSerial: `${name}:5555`,
      simulated: false,
      meta: { dockerName: name },
    };
  }

  async start(handle: DeviceHandle): Promise<DeviceHandle> {
    if (handle.simulated || this.mode === "simulate") {
      if (handle.containerId) this.simulated.set(handle.containerId, "running");
      return { ...handle, simulated: true };
    }
    await execFileAsync(this.dockerBin, ["start", String(handle.containerId)], {
      timeout: 60_000,
    });
    return handle;
  }

  async stop(handle: DeviceHandle): Promise<DeviceHandle> {
    if (handle.simulated || this.mode === "simulate") {
      if (handle.containerId) this.simulated.set(handle.containerId, "stopped");
      return handle;
    }
    await execFileAsync(this.dockerBin, ["stop", String(handle.containerId)], {
      timeout: 60_000,
    });
    return handle;
  }

  async restart(handle: DeviceHandle): Promise<DeviceHandle> {
    await this.stop(handle);
    return this.start(handle);
  }

  async destroy(handle: DeviceHandle): Promise<void> {
    if (handle.simulated || this.mode === "simulate") {
      if (handle.containerId) this.simulated.delete(handle.containerId);
      return;
    }
    try {
      await execFileAsync(this.dockerBin, ["rm", "-f", String(handle.containerId)], {
        timeout: 60_000,
      });
    } catch {
      /* already gone */
    }
  }

  async getStatus(handle: DeviceHandle): Promise<ProviderStatus> {
    if (handle.simulated || this.mode === "simulate") {
      return this.simulated.get(String(handle.containerId)) || "unknown";
    }
    try {
      const { stdout } = await execFileAsync(
        this.dockerBin,
        ["inspect", "-f", "{{.State.Running}}", String(handle.containerId)],
        { timeout: 15_000 },
      );
      return String(stdout).trim() === "true" ? "running" : "stopped";
    } catch {
      return "error";
    }
  }

  async getMetrics(handle: DeviceHandle): Promise<Record<string, number>> {
    const status = await this.getStatus(handle);
    return {
      running: status === "running" ? 1 : 0,
      simulated: handle.simulated || this.mode === "simulate" ? 1 : 0,
    };
  }
}

function parseResolution(spec: DeviceSpec): [number, number] {
  return [Math.max(720, spec.width || 1080), Math.max(1280, spec.height || 2400)];
}
