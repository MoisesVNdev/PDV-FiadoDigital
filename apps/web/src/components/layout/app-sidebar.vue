<script setup lang="ts">
import { useAuthStore } from "@/stores/auth.store.js";
import { computed, onMounted, onUnmounted } from "vue";
import { useLayoutState } from "@/composables/use-layout-state.js";

const auth = useAuthStore();
const { mobileMenuOpen, closeMobileMenu } = useLayoutState();

type NavItem = { label: string; to: string; roles: string[] };

const navItems: NavItem[] = [
  { label: "Dashboard", to: "/", roles: ["admin", "manager"] },
  { label: "Vendas", to: "/sales", roles: ["admin", "manager", "operator"] },
  { label: "Produtos", to: "/products", roles: ["admin", "manager", "stockist"] },
  { label: "Clientes", to: "/customers", roles: ["admin", "manager"] },
  { label: "Funcionários", to: "/employees", roles: ["admin", "manager"] },
  { label: "Controle", to: "/control", roles: ["admin"] },
  { label: "Notificações", to: "/notifications", roles: ["admin", "manager", "operator"] },
  { label: "Configurações", to: "/settings", roles: ["admin"] },
];

const visibleItems = computed(() =>
  navItems.filter((item) =>
    item.roles.includes(auth.user?.role ?? ""),
  ),
);

function handleEscape(event: KeyboardEvent): void {
  if (event.key !== "Escape") {
    return;
  }

  closeMobileMenu();
}

onMounted(() => {
  window.addEventListener("keydown", handleEscape);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleEscape);
});
</script>

<template>
  <aside class="hidden w-56 border-r bg-white 2xl:block">
    <nav class="flex flex-col gap-1 p-4" aria-label="Menu principal">
      <RouterLink
        v-for="item in visibleItems"
        :key="item.to"
        :to="item.to"
        class="rounded px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-primary-light hover:text-white"
        active-class="bg-primary text-white"
      >
        {{ item.label }}
      </RouterLink>
    </nav>
  </aside>

  <div
    v-if="mobileMenuOpen"
    class="fixed inset-0 z-40 bg-black/50 2xl:hidden"
    @click="closeMobileMenu"
  ></div>

  <aside
    :class="[
      'fixed inset-y-0 left-0 z-50 w-64 border-r bg-white transition-transform duration-200 2xl:hidden',
      mobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
    ]"
    role="navigation"
    aria-label="Menu de navegação"
  >
    <nav class="flex flex-col gap-1 p-4" aria-label="Menu principal mobile">
      <RouterLink
        v-for="item in visibleItems"
        :key="`mobile-${item.to}`"
        :to="item.to"
        class="rounded px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-primary-light hover:text-white"
        active-class="bg-primary text-white"
        @click="closeMobileMenu"
      >
        {{ item.label }}
      </RouterLink>
    </nav>
  </aside>
</template>
