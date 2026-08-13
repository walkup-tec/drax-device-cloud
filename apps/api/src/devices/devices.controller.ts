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
