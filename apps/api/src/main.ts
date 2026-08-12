import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { createLogger } from "@ddc/infra-common";

async function bootstrap() {
  const logger = createLogger("api");
  const app = await NestFactory.create(AppModule, { logger: false });
  app.enableCors({ origin: true, credentials: true });

  const config = new DocumentBuilder()
    .setTitle("DRAX Device Cloud API")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document);

  const port = Number(process.env.API_PORT || 4050);
  await app.listen(port);
  logger.info({ port }, "DRAX Device Cloud API listening");
}

bootstrap().catch((err) => {
  createLogger("api").error({ err }, "boot failed");
  process.exit(1);
});
