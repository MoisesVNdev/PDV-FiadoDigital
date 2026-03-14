import { describe, expect, it, vi } from "vitest";
import { useToast } from "../use-toast.js";

describe("useToast", () => {
  it("exibe toast com tipo e mensagem", () => {
    const { showToast, toastMessage, toastType, toast } = useToast();

    toast("Operação concluída", "success", 5000);

    expect(showToast.value).toBe(true);
    expect(toastMessage.value).toBe("Operação concluída");
    expect(toastType.value).toBe("success");
  });

  it("esconde toast após duração configurada", () => {
    vi.useFakeTimers();

    const { showToast, toast } = useToast();
    toast("Falha", "error", 1000);

    expect(showToast.value).toBe(true);

    vi.advanceTimersByTime(1000);

    expect(showToast.value).toBe(false);

    vi.useRealTimers();
  });
});
