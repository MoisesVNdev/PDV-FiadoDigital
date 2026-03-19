import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { config } from "../config/index.js";
import { UserRepository } from "../repositories/user.repository.js";
import { AuditLogRepository } from "../repositories/audit-log.repository.js";
import { ROLES } from "@pdv/shared";
import { forbidden, unauthorized } from "../errors/domain-error.js";

const userRepository = new UserRepository();
const auditLogRepository = new AuditLogRepository();

type AuthResult = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    username: string;
    role: string;
    can_view_cost_price: boolean;
  };
};

export class AuthService {
  async login(username: string, password: string, ipAddress?: string): Promise<AuthResult> {
    const user = await userRepository.findByUsername(username);

    if (!user) {
      const fallbackActorId = await this.getFallbackAuditActorId();

      if (fallbackActorId) {
        await auditLogRepository.create({
          action: "login_failed",
          actor_id: fallbackActorId,
          entity_type: "auth",
          entity_id: username,
          details: { username },
          ip_address: ipAddress,
        });
      }

      throw unauthorized("Credenciais inválidas");
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      await auditLogRepository.create({
        action: "login_failed",
        actor_id: user.id,
        entity_type: "auth",
        entity_id: user.id,
        details: { username },
        ip_address: ipAddress,
      });
      throw unauthorized("Credenciais inválidas");
    }

    if (!user.is_active) {
      throw forbidden("Usuário desativado");
    }

    const accessToken = this.generateAccessToken(user.id, user.role);
    const refreshToken = this.generateRefreshToken(user.id);

    await auditLogRepository.create({
      action: "login",
      actor_id: user.id,
      entity_type: "auth",
      entity_id: user.id,
      ip_address: ipAddress,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        can_view_cost_price: user.can_view_cost_price,
      },
    };
  }

  async refresh(
    refreshToken: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: {
      id: string;
      name: string;
      username: string;
      role: string;
      can_view_cost_price: boolean;
    };
  }> {
    const payload = jwt.verify(refreshToken, config.jwt.refreshSecret) as {
      sub: string;
    };

    const user = await userRepository.findById(payload.sub);

    if (!user || !user.is_active) {
      throw unauthorized("Token inválido");
    }

    const newAccessToken = this.generateAccessToken(user.id, user.role);
    const newRefreshToken = this.generateRefreshToken(user.id);

    return { 
      accessToken: newAccessToken, 
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        can_view_cost_price: user.can_view_cost_price,
      },
    };
  }

  async validateManagerPin(pin: string): Promise<string | null> {
    const managers = await userRepository.findActiveByRoles([
      ROLES.ADMIN,
      ROLES.MANAGER,
    ]);

    if (managers.length === 0) {
      return null;
    }

    for (const manager of managers) {
      if (!manager.pin_hash) {
        continue;
      }

      const isMatch = await bcrypt.compare(pin, manager.pin_hash);

      if (isMatch) {
        return manager.id;
      }
    }

    return null;
  }

  private generateAccessToken(userId: string, role: string): string {
    return jwt.sign({ sub: userId, role }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as SignOptions["expiresIn"],
    });
  }

  private generateRefreshToken(userId: string): string {
    return jwt.sign({ sub: userId }, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn as SignOptions["expiresIn"],
    });
  }

  private async getFallbackAuditActorId(): Promise<string | null> {
    const managers = await userRepository.findActiveByRoles([
      ROLES.ADMIN,
      ROLES.MANAGER,
    ]);

    return managers[0]?.id ?? null;
  }
}
