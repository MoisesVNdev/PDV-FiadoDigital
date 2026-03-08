import type { Router } from "vue-router";
import { useAuthStore } from "@/stores/auth.store.js";
import type { Role } from "@pdv/shared";

export function setupGuards(router: Router): void {
  router.beforeEach((to, _from, next) => {
    const auth = useAuthStore();

    if (to.meta.requiresAuth === false) {
      if (auth.isAuthenticated) {
        next({ name: "dashboard" });
        return;
      }
      next();
      return;
    }

    if (!auth.isAuthenticated) {
      next({ name: "login" });
      return;
    }

    const allowedRoles = to.meta.roles as Role[] | undefined;

    if (allowedRoles && !allowedRoles.includes(auth.user?.role as Role)) {
      next({ name: "dashboard" });
      return;
    }

    next();
  });
}
