import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useAuthStore } from "../auth.store.js";

describe("auth.store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("deduplica chamadas concorrentes de tryRestoreAuth", async () => {
    const store = useAuthStore();

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            accessToken: "token-restaurado",
            user: {
              id: "1",
              name: "Administrador",
              username: "admin",
              role: "admin",
              can_view_cost_price: true,
              is_active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          },
        }),
        { status: 200 },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const restoreA = store.tryRestoreAuth();
    const restoreB = store.tryRestoreAuth();

    const [resultA, resultB] = await Promise.all([restoreA, restoreB]);

    expect(resultA).toBe(true);
    expect(resultB).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(store.accessToken).toBe("token-restaurado");
  });

  it("limpa sessão quando refresh retorna falha", async () => {
    const store = useAuthStore();
    store.setAuth("token-antigo", {
      id: "1",
      name: "Operador",
      username: "operador",
      role: "operator",
      can_view_cost_price: false,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const restored = await store.tryRestoreAuth();

    expect(restored).toBe(false);
    expect(store.accessToken).toBeNull();
    expect(store.user).toBeNull();
  });
});
