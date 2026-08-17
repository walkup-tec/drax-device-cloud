import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { existsSync } from "fs";
import { promisify } from "util";
import type {
  DeviceHandle,
  DeviceSpec,
  ProviderStatus,
  VirtualDeviceProvider,
} from "./types";
import { AdbClient } from "./adb.client";

const execFileAsync = promisify(execFile);

export type RedroidProviderOptions = {
  mode: "simulate" | "docker";
  image?: string;
  dockerBin?: string;
};

/**
 * Redroid Virtual Device Provider.
 * - simulate: no Docker/KVM required (local/dev)
 * - docker: `docker run` privileged Redroid (Linux + /dev/kvm) + ADB
 */
export class RedroidProvider implements VirtualDeviceProvider {
  readonly kind = "redroid" as const;
  private readonly mode: "simulate" | "docker";
  private readonly image: string;
  private readonly dockerBin: string;
  private readonly simulated = new Map<string, ProviderStatus>();
  private readonly adb = new AdbClient();

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

    await this.assertKvmOrWarn();

    const name = `ddc-redroid-${randomUUID().slice(0, 8)}`;
    const [width, height] = parseResolution(spec);
    const args = [
      "run",
      "-d",
      "--privileged",
      "--name",
      name,
      "-p",
      "127.0.0.1::5555",
      "--device",
      "/dev/kvm",
      this.image,
      `androidboot.redroid_width=${width}`,
      `androidboot.redroid_height=${height}`,
      `androidboot.redroid_dpi=${spec.dpi}`,
    ];
    const { stdout } = await execFileAsync(this.dockerBin, args, { timeout: 180_000 });
    const containerId = String(stdout || "").trim() || name;
    const hostPort = await this.resolvePublishedAdbPort(name);
    const connectHost = process.env.ADB_CONNECT_HOST || "172.17.0.1";
    const adbSerial = `${connectHost}:${hostPort}`;

    try {
      await this.adb.waitForBoot(adbSerial, 240_000);
    } catch (err) {
      // keep container; surface boot error with serial for debug
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Redroid up but ADB boot failed (${adbSerial}): ${message}`);
    }

    return {
      provider: "redroid",
      containerId,
      adbSerial,
      simulated: false,
      meta: { dockerName: name, adbHostPort: hostPort, connectHost },
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
    if (handle.adbSerial) {
      try {
        await this.adb.waitForBoot(handle.adbSerial, 180_000);
      } catch {
        /* status may still be starting */
      }
    }
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

  async installApkFromUrl(handle: DeviceHandle, apkUrl: string): Promise<void> {
    if (handle.simulated || this.mode === "simulate") {
      throw new Error(
        "Modo simulate: não há Android real. Ative REDROID_MODE=docker com KVM + docker.sock.",
      );
    }
    if (!handle.adbSerial) throw new Error("Device sem adbSerial");
    const path = await this.adb.downloadToTemp(apkUrl, "wa");
    try {
      await this.adb.installApk(handle.adbSerial, path);
    } finally {
      await this.adb.safeUnlink(path);
    }
  }

  async screenshot(handle: DeviceHandle): Promise<Buffer> {
    if (handle.simulated || this.mode === "simulate") {
      throw new Error("Screenshot indisponível em modo simulate (sem Android real).");
    }
    if (!handle.adbSerial) throw new Error("Device sem adbSerial");
    return this.adb.screenshotPng(handle.adbSerial);
  }

  async launchApp(handle: DeviceHandle, packageName: string): Promise<void> {
    if (handle.simulated || this.mode === "simulate") {
      throw new Error("Launch indisponível em modo simulate.");
    }
    if (!handle.adbSerial) throw new Error("Device sem adbSerial");
    await this.adb.launchPackage(handle.adbSerial, packageName);
  }

  private requireRealAdb(handle: DeviceHandle): string {
    if (handle.simulated || this.mode === "simulate") {
      throw new Error("Recurso indisponível em modo simulate (sem Android real).");
    }
    if (!handle.adbSerial) throw new Error("Device sem adbSerial");
    return handle.adbSerial;
  }

  async inputTap(handle: DeviceHandle, x: number, y: number): Promise<void> {
    await this.adb.inputTap(this.requireRealAdb(handle), x, y);
  }

  async inputSwipe(
    handle: DeviceHandle,
    body: { x1: number; y1: number; x2: number; y2: number; durationMs?: number },
  ): Promise<void> {
    await this.adb.inputSwipe(
      this.requireRealAdb(handle),
      body.x1,
      body.y1,
      body.x2,
      body.y2,
      body.durationMs,
    );
  }

  async inputText(handle: DeviceHandle, text: string): Promise<void> {
    await this.adb.inputText(this.requireRealAdb(handle), text);
  }

  async inputKey(handle: DeviceHandle, key: "back" | "home" | "enter"): Promise<void> {
    await this.adb.inputKey(this.requireRealAdb(handle), key);
  }

  async pushFile(handle: DeviceHandle, remotePath: string, content: Buffer): Promise<void> {
    const serial = this.requireRealAdb(handle);
    const ext = remotePath.includes(".") ? remotePath.split(".").pop() || "bin" : "bin";
    const localPath = await this.adb.writeBufferToTemp(content, "ddc-push", ext);
    try {
      await this.adb.pushFile(serial, localPath, remotePath);
      await this.adb.scanMediaFile(serial, remotePath);
    } finally {
      await this.adb.safeUnlink(localPath);
    }
  }

  private async resolvePublishedAdbPort(containerName: string): Promise<number> {
    const { stdout } = await execFileAsync(
      this.dockerBin,
      ["port", containerName, "5555/tcp"],
      { timeout: 15_000 },
    );
    // 127.0.0.1:49172
    const m = String(stdout).match(/:(\d+)\s*$/m);
    if (!m) throw new Error(`Não foi possível ler porta ADB publicada: ${stdout}`);
    return Number(m[1]);
  }

  private async assertKvmOrWarn(): Promise<void> {
    if (!existsSync("/dev/kvm")) {
      throw new Error(
        "Host sem /dev/kvm. Redroid real exige Linux com KVM. Use um worker KVM ou REDROID_MODE=simulate só para UI.",
      );
    }
  }
}

function parseResolution(spec: DeviceSpec): [number, number] {
  return [Math.max(720, spec.width || 1080), Math.max(1280, spec.height || 2400)];
}
