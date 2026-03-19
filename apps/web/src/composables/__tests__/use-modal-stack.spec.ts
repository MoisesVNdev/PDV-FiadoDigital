import { mount } from "@vue/test-utils";
import { defineComponent, nextTick, ref } from "vue";
import { describe, expect, it } from "vitest";
import { useModalStack } from "../use-modal-stack.js";

const ModalHarness = defineComponent({
  setup() {
    const openA = ref(false);
    const openB = ref(false);
    const blockCloseB = ref(false);

    useModalStack(
      [
        { isOpen: openA, close: () => { openA.value = false; } },
        { isOpen: openB, close: () => { openB.value = false; }, canClose: () => !blockCloseB.value },
      ],
      { listenEscape: true },
    );

    return {
      openA,
      openB,
      blockCloseB,
      openFirst: () => { openA.value = true; },
      openSecond: () => { openB.value = true; },
      closeFirst: () => { openA.value = false; },
      closeSecond: () => { openB.value = false; },
    };
  },
  template: `
    <div>
      <button id="trigger-a" @click="openFirst">Abrir A</button>
      <button id="trigger-b" @click="openSecond">Abrir B</button>
      <button id="block-b" @click="blockCloseB = true">Bloquear B</button>
      <button id="unblock-b" @click="blockCloseB = false">Desbloquear B</button>

      <div v-if="openA">
        <button id="close-a" @click="closeFirst">Fechar A</button>
      </div>

      <div v-if="openB">
        <button id="close-b" @click="closeSecond">Fechar B</button>
      </div>
    </div>
  `,
});

describe("useModalStack", () => {
  it("restaura foco no gatilho ao fechar modal", async () => {
    const wrapper = mount(ModalHarness, { attachTo: document.body });

    const trigger = wrapper.get("#trigger-a").element as HTMLButtonElement;
    trigger.focus();

    await wrapper.get("#trigger-a").trigger("click");
    await nextTick();

    const closeButton = wrapper.get("#close-a").element as HTMLButtonElement;
    closeButton.focus();

    await wrapper.get("#close-a").trigger("click");
    await nextTick();
    await nextTick();

    expect(document.activeElement).toBe(trigger);

    wrapper.unmount();
  });

  it("fecha apenas o modal do topo ao pressionar Escape", async () => {
    const wrapper = mount(ModalHarness);

    await wrapper.get("#trigger-a").trigger("click");
    await wrapper.get("#trigger-b").trigger("click");
    await nextTick();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await nextTick();

    expect((wrapper.vm as { openA: boolean }).openA).toBe(true);
    expect((wrapper.vm as { openB: boolean }).openB).toBe(false);
  });

  it("respeita canClose quando Escape é pressionado", async () => {
    const wrapper = mount(ModalHarness);

    await wrapper.get("#trigger-b").trigger("click");
    await wrapper.get("#block-b").trigger("click");
    await nextTick();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await nextTick();

    expect((wrapper.vm as { openB: boolean }).openB).toBe(true);
  });

  it("nao fecha modal ao pressionar Tab", async () => {
    const wrapper = mount(ModalHarness);

    await wrapper.get("#trigger-b").trigger("click");
    await nextTick();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
    await nextTick();

    expect((wrapper.vm as { openB: boolean }).openB).toBe(true);
  });
});
