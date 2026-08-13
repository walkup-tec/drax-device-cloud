import { execFile } from "child_process";
import { promisify } from "util";
import { mkdir, unlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const execFileAsync = promisify(execFile);

export type AdbClientOptions = {
  adbBin?: string;
  connectHost?: string;
};

export class AdbClient {
  private readonly adbBin: string;
  private readonly connectHost: string;

  constructor(opts?: AdbClientOptions) {
    this.adbBin = opts?.adbBin || process.env.ADB_BIN || "adb";
    this.connectHost =
      opts?.connectHost || process.env.ADB_CONNECT_HOST || "127.0.0.1";
  }

  /** serial like `host:port` or device id */
  async connect(serial: string): Promise<void> {
    const target = serial.includes(":") ? serial : `${this.connectHost}:${serial}`;
    await execFileAsync(this.adbBin, ["connect", target], { timeout: 20_000 });
  }

  async waitForBoot(serial: string, timeoutMs = 180_000): Promise<void> {
    await this.connect(serial);
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      try {
        const { stdout } = await execFileAsync(
          this.adbBin,
          ["-s", serial, "shell", "getprop", "sys.boot_completed"],
          { timeout: 10_000 },
        );
        if (String(stdout).trim() === "1") return;
      } catch {
        /* retry */
      }
      await sleep(2000);
    }
    throw new Error(`ADB boot timeout for ${serial}`);
  }

  async installApk(serial: string, apkPath: string): Promise<void> {
    await this.connect(serial);
    await execFileAsync(this.adbBin, ["-s", serial, "install", "-r", apkPath], {
      timeout: 300_000,
    });
  }

  async screenshotPng(serial: string): Promise<Buffer> {
    await this.connect(serial);
    const { stdout } = await execFileAsync(
      this.adbBin,
      ["-s", serial, "exec-out", "screencap", "-p"],
      { timeout: 30_000, encoding: "buffer", maxBuffer: 12 * 1024 * 1024 },
    );
    return Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
  }

  async launchPackage(serial: string, packageName: string): Promise<void> {
    await this.connect(serial);
    await execFileAsync(
      this.adbBin,
      [
        "-s",
        serial,
        "shell",
        "monkey",
        "-p",
        packageName,
        "-c",
        "android.intent.category.LAUNCHER",
        "1",
      ],
      { timeout: 30_000 },
    );
  }

  async downloadToTemp(url: string, prefix = "ddc-apk"): Promise<string> {
    const dir = join(tmpdir(), "ddc-apks");
    await mkdir(dir, { recursive: true });
    const file = join(dir, `${prefix}-${Date.now()}.apk`);
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) {
      throw new Error(`Falha ao baixar APK: HTTP ${res.status}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const { writeFile } = await import("fs/promises");
    await writeFile(file, buf);
    return file;
  }

  async safeUnlink(path: string): Promise<void> {
    try {
      await unlink(path);
    } catch {
      /* ignore */
    }
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
