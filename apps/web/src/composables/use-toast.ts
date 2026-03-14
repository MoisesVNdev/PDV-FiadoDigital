import { onUnmounted, ref } from "vue";

type ToastType = "success" | "error" | "warning";

export function useToast() {
  const showToast = ref(false);
  const toastMessage = ref("");
  const toastType = ref<ToastType>("success");
  let toastTimeout: ReturnType<typeof setTimeout> | null = null;

  function toast(message: string, type: ToastType = "success", duration = 3000): void {
    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }

    toastMessage.value = message;
    toastType.value = type;
    showToast.value = true;

    toastTimeout = setTimeout(() => {
      showToast.value = false;
    }, duration);
  }

  onUnmounted(() => {
    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }
  });

  return { showToast, toastMessage, toastType, toast };
}
