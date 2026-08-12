import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RedroidProvider } from "./redroid.provider";

describe("RedroidProvider simulate", () => {
  it("provisions starts and stops", async () => {
    const p = new RedroidProvider({ mode: "simulate" });
    const handle = await p.provision({
      name: "t1",
      androidVersion: "12",
      width: 1080,
      height: 2400,
      dpi: 420,
      ramMb: 4096,
    });
    assert.equal(handle.provider, "redroid");
    assert.equal(handle.simulated, true);
    await p.start(handle);
    assert.equal(await p.getStatus(handle), "running");
    await p.stop(handle);
    assert.equal(await p.getStatus(handle), "stopped");
    await p.destroy(handle);
  });
});
