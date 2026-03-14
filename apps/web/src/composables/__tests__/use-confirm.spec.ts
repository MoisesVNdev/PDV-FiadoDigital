import { describe, expect, it } from "vitest";
import { useConfirm } from "../use-confirm.js";

describe("useConfirm", () => {
  it("abre modal de confirmação com dados fornecidos", async () => {
    const {
      showConfirm,
      confirmTitle,
      confirmMessage,
      confirmLabel,
      confirm,
      onConfirm,
    } = useConfirm();

    const promise = confirm({
      title: "Excluir item",
      message: "Deseja continuar?",
      confirmLabel: "Excluir",
    });

    expect(showConfirm.value).toBe(true);
    expect(confirmTitle.value).toBe("Excluir item");
    expect(confirmMessage.value).toBe("Deseja continuar?");
    expect(confirmLabel.value).toBe("Excluir");

    onConfirm();

    await expect(promise).resolves.toBe(true);
    expect(showConfirm.value).toBe(false);
  });

  it("retorna false ao cancelar confirmação", async () => {
    const { confirm, onCancel } = useConfirm();

    const promise = confirm({
      title: "Cancelar venda",
      message: "Tem certeza?",
    });

    onCancel();

    await expect(promise).resolves.toBe(false);
  });
});
