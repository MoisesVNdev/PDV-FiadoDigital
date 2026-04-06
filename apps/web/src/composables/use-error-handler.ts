import { useRouter } from "vue-router";
import { useToast } from "./use-toast.js";

interface ErrorResponseData {
  message?: string;
  errors?: Record<string, string[]>;
}

export function useErrorHandler() {
  const router = useRouter();
  const { toast } = useToast();

  async function handleError(response: Response): Promise<void> {
    const status = response.status;

    if (status === 401) {
      router.push({ name: "login" });
      return;
    }

    if (status === 403) {
      toast("Permissão negada para esta operação.", "warning");
      return;
    }

    if (status === 429) {
      toast("Muitas requisições. Tente novamente mais tarde.", "warning");
      return;
    }

    if (status >= 500) {
      toast(`Erro interno no servidor (Código: ${status}).`, "error");
      return;
    }

    if (status === 422) {
      try {
        const data = (await response.clone().json()) as ErrorResponseData;
        toast(data.message || "Erro de validação. Verifique os dados enviados.", "error");
      } catch {
        toast("Erro de validação.", "error");
      }
      return;
    }

    // Fallback genérico para outros erros 4xx (como 400 ou 404),
    // caso venham com mensagem estruturada.
    if (status >= 400) {
      try {
        const data = (await response.clone().json()) as ErrorResponseData;
        if (data.message) {
          toast(data.message, "error");
        }
      } catch {
        // Fallback silencioso
      }
    }
  }

  return { handleError };
}
