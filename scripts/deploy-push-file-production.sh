#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-/opt/device-cloud}"
cd "$ROOT"

echo "=== patch push-file em $ROOT ==="

# adb.client.ts — imports + métodos push
if ! grep -q 'async pushFile(serial' packages/virtual-device-provider/src/adb.client.ts; then
  sed -i 's/import { mkdir, unlink } from "fs\/promises";/import { mkdir, unlink, writeFile } from "fs\/promises";/' \
    packages/virtual-device-provider/src/adb.client.ts
  python3 <<'PY'
from pathlib import Path
p = Path("packages/virtual-device-provider/src/adb.client.ts")
text = p.read_text()
needle = "  async downloadToTemp(url: string, prefix = \"ddc-apk\"): Promise<string> {"
insert = '''  async pushFile(serial: string, localPath: string, remotePath: string): Promise<void> {
    await this.connect(serial);
    const remoteDir = remotePath.replace(/\\/[^/]+$/, "");
    if (remoteDir) {
      await execFileAsync(this.adbBin, ["-s", serial, "shell", "mkdir", "-p", remoteDir], {
        timeout: 15_000,
      }).catch(() => undefined);
    }
    await execFileAsync(this.adbBin, ["-s", serial, "push", localPath, remotePath], {
      timeout: 120_000,
    });
  }

  async scanMediaFile(serial: string, remotePath: string): Promise<void> {
    await this.connect(serial);
    const uri = `file://${remotePath.startsWith("/") ? remotePath : `/${remotePath}`}`;
    await execFileAsync(
      this.adbBin,
      [
        "-s",
        serial,
        "shell",
        "am",
        "broadcast",
        "-a",
        "android.intent.action.MEDIA_SCANNER_SCAN_FILE",
        "-d",
        uri,
      ],
      { timeout: 20_000 },
    ).catch(() => undefined);
  }

  async writeBufferToTemp(buffer: Buffer, prefix: string, ext: string): Promise<string> {
    const dir = join(tmpdir(), "ddc-files");
    await mkdir(dir, { recursive: true });
    const safeExt = ext.replace(/[^a-z0-9.]/gi, "").slice(0, 8) || "bin";
    const file = join(dir, `${prefix}-${Date.now()}.${safeExt}`);
    await writeFile(file, buffer);
    return file;
  }

'''
if needle not in text:
    raise SystemExit("adb.client.ts: anchor not found")
p.write_text(text.replace(needle, insert + needle, 1))
print("adb.client.ts patched")
PY
fi

# redroid.provider.ts
if ! grep -q 'async pushFile(handle' packages/virtual-device-provider/src/redroid.provider.ts; then
  python3 <<'PY'
from pathlib import Path
p = Path("packages/virtual-device-provider/src/redroid.provider.ts")
text = p.read_text()
needle = "  async keyevent(handle: DeviceHandle, keycode: string): Promise<void> {"
block = '''  async pushFile(handle: DeviceHandle, remotePath: string, content: Buffer): Promise<void> {
    const serial = this.requireSerial(handle);
    const ext = remotePath.includes(".") ? remotePath.split(".").pop() || "bin" : "bin";
    const localPath = await this.adb.writeBufferToTemp(content, "ddc-push", ext);
    try {
      await this.adb.pushFile(serial, localPath, remotePath);
      await this.adb.scanMediaFile(serial, remotePath);
    } finally {
      await this.adb.safeUnlink(localPath);
    }
  }

'''
idx = text.find(needle)
if idx < 0:
    raise SystemExit("redroid.provider.ts: keyevent not found")
end = text.find("\n\n", text.find("}", idx))
if end < 0:
    raise SystemExit("redroid.provider.ts: end block not found")
p.write_text(text[: end + 2] + block + text[end + 2 :])
print("redroid.provider.ts patched")
PY
fi

# device-application.service.ts
if ! grep -q 'async pushFile(id' packages/application/src/device-application.service.ts; then
  python3 <<'PY'
from pathlib import Path
p = Path("packages/application/src/device-application.service.ts")
text = p.read_text()
needle = "  private handleOf(device: Device): DeviceHandle {"
insert = '''  async pushFile(id: string, remotePath: string, content: Buffer): Promise<{ remotePath: string }> {
    const device = await this.require(id);
    const handle = device.providerHandle as unknown as DeviceHandle;
    const provider = this.provider as VirtualDeviceProvider & {
      pushFile?: (h: DeviceHandle, remotePath: string, content: Buffer) => Promise<void>;
    };
    if (!provider.pushFile) throw new Error("Provider não suporta push de arquivo");
    await provider.pushFile(handle, remotePath, content);
    return { remotePath };
  }

'''
if needle not in text:
    raise SystemExit("device-application.service.ts: anchor not found")
p.write_text(text.replace(needle, insert + needle, 1))
print("device-application.service.ts patched")
PY
fi

# devices.service.ts
if ! grep -q 'pushFile(id' apps/api/src/devices/devices.service.ts; then
  sed -i '/inputKey(id: string, tenantId: string, keycode: string) {/,/}/ {
    /}/a\
\
  pushFile(id: string, remotePath: string, content: Buffer) {\
    return this.app.pushFile(id, remotePath, content);\
  }
  }' apps/api/src/devices/devices.service.ts
fi

# devices.controller.ts
if ! grep -q 'push-file' apps/api/src/devices/devices.controller.ts; then
  python3 <<'PY'
from pathlib import Path
p = Path("apps/api/src/devices/devices.controller.ts")
text = p.read_text()
needle = "  @Post(\":id/input/tap\")"
block = '''  @Post(":id/push-file")
  async pushFile(
    @Param("id") id: string,
    @Body() body: { remotePath?: string; contentBase64?: string },
  ) {
    try {
      const remotePath = String(body?.remotePath || "").trim();
      const contentBase64 = String(body?.contentBase64 || "").trim();
      if (!remotePath.startsWith("/sdcard/Download/") || remotePath.includes("..")) {
        throw new HttpException("remotePath deve começar com /sdcard/Download/", 400);
      }
      if (!contentBase64) throw new HttpException("contentBase64 é obrigatório", 400);
      const content = Buffer.from(contentBase64, "base64");
      if (!content.length || content.length > 5 * 1024 * 1024) {
        throw new HttpException("Arquivo inválido ou maior que 5 MB", 400);
      }
      const result = await this.devices.pushFile(id, remotePath, content);
      return { ok: true, ...result };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new HttpException(message, 400);
    }
  }

'''
if needle not in text:
    raise SystemExit("devices.controller.ts: input/tap anchor not found")
p.write_text(text.replace(needle, block + needle, 1))
print("devices.controller.ts patched")
PY
fi

# health marker
sed -i 's/marker: "DEPLOY-[^"]*"/marker: "DEPLOY-2026-08-17-device-cloud-push-file-input"/' \
  apps/api/src/health.controller.ts

echo "=== build ==="
npm run build

echo "=== restart ddc-api ==="
sudo systemctl restart ddc-api.service
sleep 3
curl -fsS http://127.0.0.1:4050/health
echo ""
echo "=== done ==="
