import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { BearerAuthGuard } from "../auth/bearer.guard";
import type { AuthUser } from "../auth/auth.service";
import { DevicesService } from "./devices.service";

const WA_PACKAGE = "com.whatsapp.w4b";

@Controller("devices")
@UseGuards(BearerAuthGuard)
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Get()
  list(@Req() req: { user: AuthUser }) {
    return this.devices.list(req.user.tenantId);
  }

  @Post()
  async create(
    @Req() req: { user: AuthUser },
    @Body() body: { name?: string; description?: string },
  ) {
    const name = String(body?.name || "").trim();
    if (!name) return { error: "name é obrigatório" };
    return this.devices.create({
      tenantId: req.user.tenantId,
      ownerId: req.user.userId,
      name,
      description: body.description,
    });
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const device = await this.devices.get(id);
    if (!device) throw new NotFoundException("Device not found");
    return device;
  }

  @Patch(":id")
  async patch(@Param("id") id: string, @Body() body: { name?: string; description?: string }) {
    const device = await this.devices.get(id);
    if (!device) throw new NotFoundException("Device not found");
    return {
      ...device,
      name: body.name || device.name,
      description: body.description ?? device.description,
    };
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    await this.devices.remove(id);
    return { ok: true };
  }

  @Post(":id/start")
  start(@Param("id") id: string) {
    return this.devices.start(id);
  }

  @Post(":id/stop")
  stop(@Param("id") id: string) {
    return this.devices.stop(id);
  }

  @Post(":id/restart")
  restart(@Param("id") id: string) {
    return this.devices.restart(id);
  }

  @Post(":id/install-apk")
  async installApk(
    @Param("id") id: string,
    @Body() body: { apkUrl?: string; whatsappBusiness?: boolean },
  ) {
    try {
      let url = String(body?.apkUrl || "").trim();
      if (body?.whatsappBusiness || !url) {
        url = String(process.env.WHATSAPP_BUSINESS_APK_URL || url || "").trim();
      }
      if (!url) {
        throw new HttpException(
          "Informe apkUrl ou configure WHATSAPP_BUSINESS_APK_URL no ambiente da API.",
          400,
        );
      }
      const device = await this.devices.installApkFromUrl(id, url);
      if (body?.whatsappBusiness !== false) {
        try {
          await this.devices.launchApp(id, WA_PACKAGE);
        } catch {
          /* install ok even if launch fails */
        }
      }
      return { ok: true, device };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new HttpException(message, 400);
    }
  }

  @Get(":id/screenshot")
  @Header("Content-Type", "image/png")
  async screenshot(@Param("id") id: string, @Res() res: Response) {
    try {
      const png = await this.devices.screenshot(id);
      res.setHeader("Cache-Control", "no-store");
      res.send(png);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new HttpException(message, 400);
    }
  }

 @Post(":id/launch-whatsapp-business")
 async launchWa(@Param("id") id: string) {
 try {
 const device = await this.devices.launchApp(id, WA_PACKAGE);
 return { ok: true, device, package: WA_PACKAGE };
 } catch (err) {
 const message = err instanceof Error ? err.message : String(err);
 throw new HttpException(message, 400);
 }
 }

 @Post(":id/push-file")
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

 @Post(":id/input/tap")
 async inputTap(@Param("id") id: string, @Body() body: { x?: number; y?: number }) {
 try {
 const x = Number(body?.x);
 const y = Number(body?.y);
 if (!Number.isFinite(x) || !Number.isFinite(y)) {
 throw new HttpException("Coordenadas x/y inválidas", 400);
 }
 await this.devices.inputTap(id, Math.round(x), Math.round(y));
 return { ok: true };
 } catch (err) {
 if (err instanceof HttpException) throw err;
 const message = err instanceof Error ? err.message : String(err);
 throw new HttpException(message, 400);
 }
 }

 @Post(":id/input/swipe")
 async inputSwipe(
 @Param("id") id: string,
 @Body() body: { x1?: number; y1?: number; x2?: number; y2?: number; durationMs?: number },
 ) {
 try {
 const x1 = Number(body?.x1);
 const y1 = Number(body?.y1);
 const x2 = Number(body?.x2);
 const y2 = Number(body?.y2);
 if (![x1, y1, x2, y2].every(Number.isFinite)) {
 throw new HttpException("Coordenadas inválidas", 400);
 }
 await this.devices.inputSwipe(id, {
 x1: Math.round(x1),
 y1: Math.round(y1),
 x2: Math.round(x2),
 y2: Math.round(y2),
 durationMs: Math.max(150, Math.min(800, Math.round(Number(body?.durationMs ?? 280)))),
 });
 return { ok: true };
 } catch (err) {
 if (err instanceof HttpException) throw err;
 const message = err instanceof Error ? err.message : String(err);
 throw new HttpException(message, 400);
 }
 }

 @Post(":id/input/text")
 async inputText(@Param("id") id: string, @Body() body: { text?: string }) {
 try {
 const text = String(body?.text || "");
 if (!text || text.length > 200) throw new HttpException("Texto inválido", 400);
 await this.devices.inputText(id, text);
 return { ok: true };
 } catch (err) {
 if (err instanceof HttpException) throw err;
 const message = err instanceof Error ? err.message : String(err);
 throw new HttpException(message, 400);
 }
 }

 @Post(":id/input/key")
 async inputKey(@Param("id") id: string, @Body() body: { key?: string }) {
 try {
 const key = String(body?.key || "").trim().toLowerCase();
 if (key !== "back" && key !== "home" && key !== "enter") {
 throw new HttpException("Tecla inválida", 400);
 }
 await this.devices.inputKey(id, key);
 return { ok: true };
 } catch (err) {
 if (err instanceof HttpException) throw err;
 const message = err instanceof Error ? err.message : String(err);
 throw new HttpException(message, 400);
 }
 }

 @Get(":id/stream")
  stream(@Param("id") id: string) {
    return {
      mode: "screenshot-poll",
      hint: "Use GET /devices/:id/screenshot a cada 2s para ver a tela (QR do WhatsApp).",
      screenshotPath: `/devices/${id}/screenshot`,
      statusCode: 200,
    };
  }
}
