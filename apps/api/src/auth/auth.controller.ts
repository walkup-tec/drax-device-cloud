import { Body, Controller, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("sso")
  sso(@Body() body: { ssoToken?: string }) {
    return this.auth.exchangeSso(String(body?.ssoToken || ""));
  }

  @Post("login")
  login(@Body() body: { email?: string }) {
    return this.auth.loginDev(String(body?.email || ""));
  }

  @Post("refresh")
  refresh() {
    return { message: "Use /auth/login or /auth/sso in MVP" };
  }
}
