import { randomUUID } from "node:crypto";
import type { AuthPayload } from "../middlewares/auth.middleware.js";

type WsTokenPayload = {
  user: AuthPayload;
  expiresAt: number;
};

const WS_TOKEN_TTL_MS = 60_000;

class WsTokenService {
  private readonly store = new Map<string, WsTokenPayload>();

  issueToken(user: AuthPayload): { token: string; expires_at: string } {
    const token = randomUUID();
    const expiresAt = Date.now() + WS_TOKEN_TTL_MS;

    this.store.set(token, { user, expiresAt });

    return {
      token,
      expires_at: new Date(expiresAt).toISOString(),
    };
  }

  consumeToken(token: string): AuthPayload | null {
    const found = this.store.get(token);

    if (!found) {
      return null;
    }

    this.store.delete(token);

    if (found.expiresAt < Date.now()) {
      return null;
    }

    return found.user;
  }
}

export const wsTokenService = new WsTokenService();
