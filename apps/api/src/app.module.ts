import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { AuthModule } from "./auth/auth.module";
import { DevicesModule } from "./devices/devices.module";

@Module({
  imports: [AuthModule, DevicesModule],
  controllers: [HealthController],
})
export class AppModule {}
