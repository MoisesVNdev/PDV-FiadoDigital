import { beforeEach, describe, expect, it, vi } from "vitest";
import { useApi } from "../use-api.js";

const pushMock = vi.fn();
const tryRestoreAuthMock = vi.fn<() => Promise<boolean>>();
const clearAuthMock = vi.fn();

const authStoreMock = {
  accessToken: null as string | null,
  tryRestoreAuth: tryRestoreAuthMock,
  clearAuth: clearAuthMock,
};

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/stores/auth.store.js", () => ({
  useAuthStore: () => authStoreMock,
}));

describe("useApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStoreMock.accessToken = null;
  });

  it("redireciona para login quando não consegue restaurar sessão", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    tryRestoreAuthMock.mockResolvedValue(false);

    const { authenticatedFetch } = useApi();

    await expect(authenticatedFetch("/api/sales")).rejects.toThrow("Sessão expirada");
    expect(pushMock).toHaveBeenCalledWith({ name: "login" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("faz retry automático em 401 após refresh do token", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    authStoreMock.accessToken = "token-antigo";
    tryRestoreAuthMock.mockImplementation(async () => {
      authStoreMock.accessToken = "token-novo";
      return true;
    });

    const { authenticatedFetch } = useApi();
    const response = await authenticatedFetch("/api/sales", { method: "GET" });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const retryOptions = fetchMock.mock.calls[1]?.[1] as RequestInit;
    const retryHeaders = retryOptions.headers as Headers;
    expect(retryHeaders.get("Authorization")).toBe("Bearer token-novo");
  });

  it("limpa autenticação e redireciona quando refresh falha após 401", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    authStoreMock.accessToken = "token-expirado";
    tryRestoreAuthMock.mockResolvedValue(false);

    const { authenticatedFetch } = useApi();

    await expect(authenticatedFetch("/api/products")).rejects.toThrow("Sessão expirada");
    expect(clearAuthMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith({ name: "login" });
  });
});
