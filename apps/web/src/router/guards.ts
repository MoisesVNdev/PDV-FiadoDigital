import type { Router } from "vue-router";
import { useAuthStore } from "@/stores/auth.store.js";
import type { Role } from "@pdv/shared";
import { ROLES } from "@pdv/shared";

function getDefaultRouteByRole(role: Role): string {
  const roleRoutes: Record<Role, string> = {
    [ROLES.ADMIN]: "dashboard",
    [ROLES.MANAGER]: "dashboard",
    [ROLES.STOCKIST]: "products",
    [ROLES.OPERATOR]: "sales",
  };
  return roleRoutes[role] || "dashboard";
}

export function setupGuards(router: Router): void {
  router.beforeEach((to, _from, next) => {
    const auth = useAuthStore();

    // Rotas públicas (login)
    if (to.meta.requiresAuth === false) {
      if (auth.isAuthenticated) {
        const defaultRoute = getDefaultRouteByRole(auth.user?.role as Role);
        next({ name: defaultRoute });
        return;
      }
      next();
      return;
    }

    // Rota privada sem autenticação
    if (!auth.isAuthenticated) {
      next({ name: "login" });
      return;
    }

    // Validar role-based access
    const allowedRoles = to.meta.roles as Role[] | undefined;

    if (allowedRoles && !allowedRoles.includes(auth.user?.role as Role)) {
      const defaultRoute = getDefaultRouteByRole(auth.user?.role as Role);
      next({ name: defaultRoute });
      return;
    }

    next();
  });
}

