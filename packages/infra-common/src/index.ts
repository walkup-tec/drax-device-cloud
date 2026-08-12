export type Logger = {
  info: (objOrMsg: unknown, msg?: string) => void;
  warn: (objOrMsg: unknown, msg?: string) => void;
  error: (objOrMsg: unknown, msg?: string) => void;
  debug: (objOrMsg: unknown, msg?: string) => void;
};

function write(level: string, service: string, objOrMsg: unknown, msg?: string) {
  const payload =
    typeof objOrMsg === "string"
      ? { level, service, msg: objOrMsg, time: new Date().toISOString() }
      : { level, service, ...(objOrMsg as object), msg, time: new Date().toISOString() };
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

/** Structured logger without heavy deps (Pino-compatible call shape). */
export function createLogger(service: string): Logger {
  return {
    info: (o, m) => write("info", service, o, m),
    warn: (o, m) => write("warn", service, o, m),
    error: (o, m) => write("error", service, o, m),
    debug: (o, m) => write("debug", service, o, m),
  };
}

export type EventBus = {
  publish(routingKey: string, payload: Record<string, unknown>): Promise<void>;
};

export class InMemoryEventBus implements EventBus {
  readonly events: Array<{ routingKey: string; payload: Record<string, unknown> }> = [];
  async publish(routingKey: string, payload: Record<string, unknown>): Promise<void> {
    this.events.push({ routingKey, payload });
  }
}

export async function createRabbitEventBus(url?: string): Promise<EventBus> {
  const amqpUrl = url || process.env.RABBITMQ_URL;
  if (!amqpUrl) return new InMemoryEventBus();
  try {
    const amqp = await import("amqplib");
    const conn = await amqp.connect(amqpUrl);
    const ch = await conn.createChannel();
    const exchange = "ddc.device.events";
    await ch.assertExchange(exchange, "topic", { durable: true });
    return {
      async publish(routingKey, payload) {
        ch.publish(exchange, routingKey, Buffer.from(JSON.stringify(payload)), {
          contentType: "application/json",
          persistent: true,
        });
      },
    };
  } catch {
    return new InMemoryEventBus();
  }
}

export function withSpan<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  return fn().finally(() => {
    createLogger("otel").debug({ span: name, ms: Date.now() - start }, "span");
  });
}
