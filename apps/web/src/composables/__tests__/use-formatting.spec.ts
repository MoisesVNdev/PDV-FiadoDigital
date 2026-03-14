import { describe, expect, it } from "vitest";
import { useFormatting } from "../use-formatting.js";

describe("useFormatting", () => {
  const formatting = useFormatting();

  it("formata telefone para input no padrão brasileiro", () => {
    expect(formatting.formatPhoneForInput("11987654321")).toBe("(11) 9 8765-4321");
    expect(formatting.formatPhoneForInput("11")).toBe("(11");
  });

  it("normaliza dígitos e formata telefone para display", () => {
    expect(formatting.normalizePhoneDigits("(11) 9 8765-4321")).toBe("11987654321");
    expect(formatting.formatPhoneForDisplay("11987654321")).toBe("(11) 9 8765-4321");
    expect(formatting.formatPhoneForDisplay(null)).toBe("-");
  });

  it("formata e parseia moeda em centavos", () => {
    const formatted = formatting.formatCurrencyInput("1234");
    expect(formatted.startsWith("R$")).toBe(true);
    expect(formatted.endsWith("12,34")).toBe(true);
    expect(formatting.parseCurrencyInputToCents("R$ 12,34")).toBe(1234);
    expect(formatting.parseCurrencyInputToNullableCents("")).toBeNull();
  });

  it("formata estoque para unitário e a granel", () => {
    expect(formatting.formatStockQuantity(3, false)).toBe("3 un");
    expect(formatting.formatStockQuantity(1.5, true, 3)).toBe("1,500 kg");
  });

  it("formata percentuais com precisão configurável", () => {
    expect(formatting.displayPercent(2.5)).toBe("2,50");
    expect(formatting.displayPercent(2.5, 1)).toBe("2,5");
  });
});
