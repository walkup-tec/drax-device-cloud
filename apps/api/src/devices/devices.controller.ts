import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { BearerAuthGuard } from "../auth/bearer.guard";
import type { AuthUser } from "../auth/auth.service";
import { DevicesService } from "./devices.service";

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
    // MVP: name/description via recreate not needed — return current
    return { ...device, name: body.name || device.name, description: body.description ?? device.description };
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

  @Get(":id/stream")
  stream() {
    return {
      statusCode: 501,
      message: "WebRTC streaming reserved for Beta. See docs/architecture.md",
    };
  }
}
