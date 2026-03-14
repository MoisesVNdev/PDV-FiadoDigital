// @vitest-environment jsdom

import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWebSocket } from "../use-websocket.js";

const authStoreMock = {
  accessToken: null as string | null,
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
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);
    delete (globalThis as Record<string, unknown>).__pdvWsState;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as Record<string, unknown>).__pdvWsState;
  });

  it("conecta quando há token e atualiza estado em onopen", async () => {
    authStoreMock.accessToken = "abc-123";

    const TestComponent = defineComponent({
      setup() {
        useWebSocket();
        return {};
      },
      template: "<div />",
    });

    const wrapper = mount(TestComponent);

    expect(FakeWebSocket.instances.length).toBe(1);
    expect(FakeWebSocket.instances[0]?.url).toContain("token=abc-123");

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
      vi.runOnlyPendingTimers();
    }

    const wsState = (globalThis as Record<string, unknown>).__pdvWsState as {
      connectionWarning: { value: string | null };
    };

    expect(wsState.connectionWarning.value).toContain("Conexão com o servidor perdida");

    wrapper.unmount();
  });
});
