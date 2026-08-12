"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Device = {
  id: string;
  name: string;
  status: string;
  androidVersion: string;
  model: string;
  provider: string;
  lastBoot?: string | null;
};

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4050";

export default function HomePage() {
  const [token, setToken] = useState("");
  const [email] = useState("mozart.pmo@gmail.com");
  const [name, setName] = useState("Pixel QA");
  const [devices, setDevices] = useState<Device[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const headers = useMemo(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  const login = useCallback(async () => {
    setError("");
    const params = new URLSearchParams(window.location.search);
    const sso = params.get("sso");
    try {
      if (sso) {
        const res = await fetch(`${API}/auth/sso`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ssoToken: sso }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "SSO falhou");
        setToken(data.accessToken);
        window.history.replaceState({}, "", "/");
      } else {
        const res = await fetch(`${API}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Login falhou");
        setToken(data.accessToken);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [email]);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/devices`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Falha ao listar");
      setDevices(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [headers, token]);

  useEffect(() => {
    void login();
  }, [login]);

  useEffect(() => {
    if (token) void refresh();
  }, [token, refresh]);

  async function createDevice() {
    setError("");
    const res = await fetch(`${API}/devices`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || data.error || "Falha ao criar");
      return;
    }
    await refresh();
  }

  async function act(id: string, action: "start" | "stop" | "restart" | "delete") {
    setError("");
    const res = await fetch(
      action === "delete" ? `${API}/devices/${id}` : `${API}/devices/${id}/${action}`,
      { method: action === "delete" ? "DELETE" : "POST", headers },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.message || `Falha em ${action}`);
      return;
    }
    await refresh();
  }

  return (
    <main>
      <h1>DRAX Device Cloud</h1>
      <p className="sub">Dispositivos Android virtuais (Redroid Provider · MVP)</p>

      <div className="toolbar">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do device" />
        <button type="button" onClick={() => void createDevice()} disabled={!token}>
          Criar device
        </button>
        <button type="button" className="secondary" onClick={() => void refresh()} disabled={!token || loading}>
          Atualizar
        </button>
      </div>

      <div className="grid">
        {devices.map((d) => (
          <div className="card" key={d.id}>
            <div className="row">
              <strong>{d.name}</strong>
              <span className={`badge ${d.status}`}>{d.status}</span>
            </div>
            <div className="row" style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
              <span>
                {d.model} · Android {d.androidVersion} · {d.provider}
              </span>
              <span>{d.lastBoot ? `boot ${new Date(d.lastBoot).toLocaleString("pt-BR")}` : "—"}</span>
            </div>
            <div className="actions">
              <button type="button" className="secondary" onClick={() => void act(d.id, "start")}>
                Start
              </button>
              <button type="button" className="secondary" onClick={() => void act(d.id, "stop")}>
                Stop
              </button>
              <button type="button" className="secondary" onClick={() => void act(d.id, "restart")}>
                Restart
              </button>
              <button type="button" className="danger" onClick={() => void act(d.id, "delete")}>
                Excluir
              </button>
            </div>
          </div>
        ))}
        {!devices.length && token && !loading ? (
          <div className="card">Nenhum device ainda. Crie o primeiro acima.</div>
        ) : null}
      </div>
      {error ? <p className="err">{error}</p> : null}
    </main>
  );
}
