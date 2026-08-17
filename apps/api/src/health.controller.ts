import { Controller, Get } from "@nestjs/common";

@Controller()
export class HealthController {
  @Get("health")
  health() {
    return {
      ok: true,
      service: "drax-device-cloud-api",
      marker: "DEPLOY-2026-08-17-device-cloud-push-file-input",
    };
  }

  @Get("metrics")
  metrics() {
    return "# HELP ddc_up 1 if process is up\nddc_up 1\n";
  }
}
