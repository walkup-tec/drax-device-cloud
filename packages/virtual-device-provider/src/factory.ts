import type { VirtualDeviceProvider } from "./index";
import { RedroidProvider } from "./redroid.provider";

export function createVirtualDeviceProvider(
  kind: string = process.env.DDC_PROVIDER || "redroid",
): VirtualDeviceProvider {
  if (kind !== "redroid") {
    throw new Error(`Provider "${kind}" is not enabled in MVP. Use redroid.`);
  }
  const mode = String(process.env.REDROID_MODE || "simulate").toLowerCase() === "docker"
    ? "docker"
    : "simulate";
  return new RedroidProvider({ mode, image: process.env.REDROID_IMAGE });
}
