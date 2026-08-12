import { Injectable, UnauthorizedException } from "@nestjs/common";
import crypto from "crypto";
import jwt from "jsonwebtoken";

export type AuthUser = {
  email: string;
  tenantId: string;
  userId: string;
  role: string;
};

function verifyHmacSso(token: string, secret: string): Record<string, unknown> {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) throw new Error("formato inválido");
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  if (sig !== expected) throw new Error("assinatura inválida");
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (payload.aud && payload.aud !== "drax-device-cloud") throw new Error("audience");
  if (payload.exp && Number(payload.exp) < Math.floor(Date.now() / 1000)) {
    throw new Error("expirado");
  }
  return payload;
}

@Injectable()
export class AuthService {
  private accessSecret = process.env.JWT_ACCESS_SECRET || "dev-access";
  private refreshSecret = process.env.JWT_REFRESH_SECRET || "dev-refresh";
  private ssoSecret = process.env.DEVICE_CLOUD_SSO_SECRET || "dev-sso";

  exchangeSso(ssoToken: string) {
    let payload: Record<string, unknown>;
    try {
      payload = verifyHmacSso(ssoToken, this.ssoSecret);
    } catch {
      try {
        payload = jwt.verify(ssoToken, this.ssoSecret) as Record<string, unknown>;
      } catch {
        throw new UnauthorizedException("SSO token inválido");
      }
    }
    const email = String(payload.sub || payload.email || "").toLowerCase();
    if (email !== "mozart.pmo@gmail.com") {
      throw new UnauthorizedException("Usuário não autorizado no Device Cloud MVP");
    }
    const user: AuthUser = {
      email,
      tenantId: String(payload.tenant || process.env.DEFAULT_TENANT_ID),
      userId: String(payload.userId || "00000000-0000-4000-8000-000000000011"),
      role: String(payload.role || "admin"),
    };
    return this.issueTokens(user);
  }

  loginDev(email: string) {
    const normalized = String(email || "").trim().toLowerCase();
    if (normalized !== "mozart.pmo@gmail.com") {
      throw new UnauthorizedException("Somente mozart.pmo@gmail.com no MVP");
    }
    return this.issueTokens({
      email: normalized,
      tenantId: process.env.DEFAULT_TENANT_ID || "00000000-0000-4000-8000-000000000001",
      userId: "00000000-0000-4000-8000-000000000011",
      role: "admin",
    });
  }

  verifyAccess(token: string): AuthUser {
    try {
      const payload = jwt.verify(token, this.accessSecret) as jwt.JwtPayload;
      return {
        email: String(payload.sub),
        tenantId: String(payload.tenantId),
        userId: String(payload.userId),
        role: String(payload.role || "owner"),
      };
    } catch {
      throw new UnauthorizedException("Token inválido");
    }
  }

  private issueTokens(user: AuthUser) {
    const accessToken = jwt.sign(
      { sub: user.email, tenantId: user.tenantId, userId: user.userId, role: user.role },
      this.accessSecret,
      { expiresIn: "2h" },
    );
    const refreshToken = jwt.sign({ sub: user.email }, this.refreshSecret, { expiresIn: "7d" });
    return { accessToken, refreshToken, user };
  }
}
