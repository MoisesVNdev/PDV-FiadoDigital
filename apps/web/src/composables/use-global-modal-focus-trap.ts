import { onMounted, onUnmounted } from "vue";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

function getTopmostModal(): HTMLElement | null {
  const modals = Array.from(
    document.querySelectorAll<HTMLElement>("[role='dialog'][aria-modal='true']"),
  ).filter((modal) => modal.getClientRects().length > 0);

  if (modals.length === 0) {
    return null;
  }

  return modals.reduce((topmost, current) => {
    const topmostZ = Number.parseInt(window.getComputedStyle(topmost).zIndex || "0", 10);
    const currentZ = Number.parseInt(window.getComputedStyle(current).zIndex || "0", 10);

    if (currentZ >= topmostZ) {
      return current;
    }

    return topmost;
  });
}

function focusFirstElement(modal: HTMLElement): void {
  const first = modal.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
  first?.focus();
}

function trapFocus(event: KeyboardEvent): void {
  if (event.key !== "Tab") {
    return;
  }

  const topmostModal = getTopmostModal();

  if (!topmostModal) {
    return;
  }

  const focusable = Array.from(
    topmostModal.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => !element.hasAttribute("aria-hidden"));

  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement as HTMLElement | null;

  if (!active || !topmostModal.contains(active)) {
    event.preventDefault();
    first?.focus();
    return;
  }

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last?.focus();
    return;
  }

  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first?.focus();
  }
}

function ensureModalHasFocus(): void {
  const topmostModal = getTopmostModal();

  if (!topmostModal) {
    return;
  }

  const active = document.activeElement as HTMLElement | null;

  if (active && topmostModal.contains(active)) {
    return;
  }

  focusFirstElement(topmostModal);
}

export function useGlobalModalFocusTrap() {
  onMounted(() => {
    document.addEventListener("keydown", trapFocus, true);
    document.addEventListener("focusin", ensureModalHasFocus, true);
  });

  onUnmounted(() => {
    document.removeEventListener("keydown", trapFocus, true);
    document.removeEventListener("focusin", ensureModalHasFocus, true);
  });
}
