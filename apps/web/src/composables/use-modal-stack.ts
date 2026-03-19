import { nextTick, onMounted, onUnmounted, type Ref, watch } from "vue";

export interface ModalStackEntry {
  isOpen: Ref<boolean>;
  close: () => void;
  canClose?: () => boolean;
}

interface UseModalStackOptions {
  listenEscape?: boolean;
}

export function useModalStack(
  entries: readonly ModalStackEntry[],
  options: UseModalStackOptions = {},
): void {
  const triggers = new WeakMap<Ref<boolean>, HTMLElement | null>();
  const listenEscape = options.listenEscape ?? true;

  for (const entry of entries) {
    watch(
      () => entry.isOpen.value,
      (isOpen, wasOpen) => {
        if (isOpen && !wasOpen) {
          const activeElement = document.activeElement;
          triggers.set(entry.isOpen, activeElement instanceof HTMLElement ? activeElement : null);
          return;
        }

        if (!isOpen && wasOpen) {
          const trigger = triggers.get(entry.isOpen);

          if (!trigger || !document.contains(trigger)) {
            return;
          }

          void nextTick(() => {
            trigger.focus();
          });
        }
      },
    );
  }

  function handleEscape(event: KeyboardEvent): void {
    if (event.key !== "Escape") {
      return;
    }

    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index];

      if (!entry?.isOpen.value) {
        continue;
      }

      if (entry.canClose && !entry.canClose()) {
        return;
      }

      event.preventDefault();
      entry.close();
      return;
    }
  }

  onMounted(() => {
    if (!listenEscape) {
      return;
    }

    window.addEventListener("keydown", handleEscape);
  });

  onUnmounted(() => {
    if (!listenEscape) {
      return;
    }

    window.removeEventListener("keydown", handleEscape);
  });
}
