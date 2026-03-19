// @vitest-environment jsdom

import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWebSocket } from "../use-websocket.js";

const fetchMock = vi.fn();

const authStoreMock = {
  accessToken: null as string | null,
  tryRestoreAuth: vi.fn(async () => false),
};

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];

  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  close(): void {
    this.onclose?.({} as CloseEvent);
  }
}

vi.mock("@/stores/auth.store.js", () => ({
  useAuthStore: () => authStoreMock,
}));

describe("useWebSocket", () => {
  beforeEach(() => {
    authStoreMock.accessToken = null;
    authStoreMock.tryRestoreAuth.mockClear();
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    delete (globalThis as Record<string, unknown>).__pdvWsState;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as Record<string, unknown>).__pdvWsState;
  });

  it("conecta quando há token e atualiza estado em onopen", async () => {
    authStoreMock.accessToken = "abc-123";
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { ws_token: "ws-ephemeral-token" } }),
    } as Response);

    const TestComponent = defineComponent({
      setup() {
        useWebSocket();
        return {};
      },
      template: "<div />",
    });

    const wrapper = mount(TestComponent);

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(FakeWebSocket.instances.length).toBe(1);
    expect(FakeWebSocket.instances[0]?.url).toContain("ws_token=ws-ephemeral-token");

    FakeWebSocket.instances[0]?.onopen?.({} as Event);

    const wsState = (globalThis as Record<string, unknown>).__pdvWsState as {
      isConnected: { value: boolean };
      isOnline: { value: boolean };
    };

    expect(wsState.isConnected.value).toBe(true);
    expect(wsState.isOnline.value).toBe(true);

    wrapper.unmount();
  });

  it("após tentativas máximas sem token exibe aviso de conexão", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);

    const TestComponent = defineComponent({
      setup() {
        useWebSocket();
        return {};
      },
      template: "<div />",
    });

    const wrapper = mount(TestComponent);

    for (let index = 0; index < 12; index += 1) {
      await vi.runOnlyPendingTimersAsync();
    }

    const wsState = (globalThis as Record<string, unknown>).__pdvWsState as {
      connectionWarning: { value: string | null };
    };

    expect(wsState.connectionWarning.value).toBe("Conexão com o servidor perdida. Verifique a rede.");
    expect(authStoreMock.tryRestoreAuth).toHaveBeenCalled();

    wrapper.unmount();
  });
});
