#!/usr/bin/env node
/**
 * Smoke: login → create → stop → start → delete (REDROID_MODE=simulate).
 */
const API = process.env.API_URL || "http://127.0.0.1:4050";

async function main() {
  const login = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "mozart.pmo@gmail.com" }),
  });
  const loginJson = await login.json();
  if (!login.ok) throw new Error(JSON.stringify(loginJson));
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${loginJson.accessToken}`,
  };
  const created = await fetch(`${API}/devices`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: `smoke-${Date.now()}` }),
  });
  const device = await created.json();
  if (!created.ok) throw new Error(JSON.stringify(device));
  if (device.status !== "ONLINE") throw new Error(`expected ONLINE got ${device.status}`);
  await fetch(`${API}/devices/${device.id}/stop`, { method: "POST", headers });
  await fetch(`${API}/devices/${device.id}/start`, { method: "POST", headers });
  await fetch(`${API}/devices/${device.id}`, { method: "DELETE", headers });
  console.log(JSON.stringify({ ok: true, deviceId: device.id }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
