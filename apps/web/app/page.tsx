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
  metadata?: Record<string, unknown>;
};

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4050";

export default function HomePage() {
  const [token, setToken] = useState("");
  const [email] = useState("mozart.pmo@gmail.com");
  const [name, setName] = useState("Pixel WA Business");
  const [devices, setDevices] = useState<Device[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [screenId, setScreenId] = useState<string | null>(null);
  const [screenUrl, setScreenUrl] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!screenId || !token) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`${API}/devices/${screenId}/screenshot`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (!cancelled) setError(data.message || "Falha no screenshot");
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (!cancelled) {
          setScreenUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return url;
          });
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    };
    void tick();
    const t = setInterval(() => void tick(), 2500);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [screenId, token]);

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

  async function installWhatsApp(id: string) {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`${API}/devices/${id}/install-apk`, {
        method: "POST",
        headers,
        body: JSON.stringify({ whatsappBusiness: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Falha ao instalar WhatsApp Business");
      setScreenId(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main>
      <h1>DRAX Device Cloud</h1>
      <p className="sub">
        Celular Android virtual (Redroid). Instale WhatsApp Business e escaneie o QR pela tela ao lado.
      </p>

      <div className="toolbar">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do device" />
        <button type="button" onClick={() => void createDevice()} disabled={!token}>
          Criar celular virtual
        </button>
        <button type="button" className="secondary" onClick={() => void refresh()} disabled={!token || loading}>
          Atualizar
        </button>
      </div>

      <div className="layout-2">
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
                <button
                  type="button"
                  onClick={() => void installWhatsApp(d.id)}
                  disabled={busyId === d.id}
                >
                  {busyId === d.id ? "Instalando…" : "Instalar WA Business"}
                </button>
                <button type="button" className="secondary" onClick={() => setScreenId(d.id)}>
                  Ver tela (QR)
                </button>
                <button type="button" className="danger" onClick={() => void act(d.id, "delete")}>
                  Excluir
                </button>
              </div>
            </div>
          ))}
          {!devices.length && token && !loading ? (
            <div className="card">Nenhum device ainda. Crie o primeiro celular virtual acima.</div>
          ) : null}
        </div>

        <div className="card screen-panel">
          <div className="row">
            <strong>Tela do aparelho</strong>
            {screenId ? (
              <button type="button" className="secondary" onClick={() => setScreenId(null)}>
                Fechar
              </button>
            ) : null}
          </div>
          <p className="hint">
            Após instalar o WhatsApp Business, use esta tela para ver o QR e vincular o número com o app
            WhatsApp no seu celular físico (aparelhos vinculados).
          </p>
          {screenUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={screenUrl} alt="Screenshot do device" className="phone-screen" />
          ) : (
            <div className="phone-placeholder">Selecione «Ver tela (QR)» em um device ONLINE real (Redroid).</div>
          )}
        </div>
      </div>
      {error ? <p className="err">{error}</p> : null}
    </main>
  );
}
