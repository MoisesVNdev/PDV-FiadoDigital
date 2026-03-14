import { ref } from "vue";

const mobileMenuOpen = ref(false);

export function useLayoutState() {
  function openMobileMenu(): void {
    mobileMenuOpen.value = true;
  }

  function closeMobileMenu(): void {
    mobileMenuOpen.value = false;
  }

  return {
    mobileMenuOpen,
    openMobileMenu,
    closeMobileMenu,
  };
}
