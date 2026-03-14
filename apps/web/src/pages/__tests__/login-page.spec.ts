import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, nextTick } from "vue";
import LoginPage from "../login-page.vue";

const loginMock = vi.fn();

vi.mock("vue-router", () => ({
  useRoute: () => ({
    query: {},
  }),
}));

vi.mock("@/composables/use-auth.js", () => ({
  useAuth: () => ({
    login: loginMock,
  }),
}));

describe("login-page", () => {
  it("submete credenciais usando composable de autenticação", async () => {
    loginMock.mockResolvedValueOnce(undefined);

    const wrapper = mount(LoginPage, {
      global: {
        stubs: {
          RouterLink: defineComponent({ template: "<a><slot /></a>" }),
        },
      },
    });

    await wrapper.get("#username").setValue("operador");
    await wrapper.get("#password").setValue("123456");
    await wrapper.get("form").trigger("submit.prevent");

    expect(loginMock).toHaveBeenCalledWith("operador", "123456");
  });

  it("exibe mensagem de erro quando login falha", async () => {
    loginMock.mockRejectedValueOnce(new Error("Credenciais inválidas"));

    const wrapper = mount(LoginPage);

    await wrapper.get("#username").setValue("operador");
    await wrapper.get("#password").setValue("000000");
    await wrapper.get("form").trigger("submit.prevent");
    await nextTick();

    expect(wrapper.text()).toContain("Credenciais inválidas");
  });
});
