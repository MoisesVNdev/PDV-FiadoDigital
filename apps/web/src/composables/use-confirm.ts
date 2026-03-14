import { ref } from "vue";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
}

export function useConfirm() {
  const showConfirm = ref(false);
  const confirmTitle = ref("");
  const confirmMessage = ref("");
  const confirmLabel = ref("Confirmar");
  let resolveFn: ((value: boolean) => void) | null = null;

  function confirm(options: ConfirmOptions): Promise<boolean> {
    confirmTitle.value = options.title;
    confirmMessage.value = options.message;
    confirmLabel.value = options.confirmLabel ?? "Confirmar";
    showConfirm.value = true;

    return new Promise((resolve) => {
      resolveFn = resolve;
    });
  }

  function closeWithResult(result: boolean): void {
    showConfirm.value = false;
    resolveFn?.(result);
    resolveFn = null;
  }

  function onConfirm(): void {
    closeWithResult(true);
  }

  function onCancel(): void {
    closeWithResult(false);
  }

  return {
    showConfirm,
    confirmTitle,
    confirmMessage,
    confirmLabel,
    confirm,
    onConfirm,
    onCancel,
  };
}
