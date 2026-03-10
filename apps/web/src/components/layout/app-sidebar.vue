<script setup lang="ts">
import { useAuthStore } from "@/stores/auth.store.js";
import { computed } from "vue";

const auth = useAuthStore();

type NavItem = { label: string; to: string; roles: string[] };

const navItems: NavItem[] = [
  { label: "Dashboard", to: "/", roles: ["admin", "manager"] },
  { label: "Vendas", to: "/sales", roles: ["admin", "manager", "operator"] },
  { label: "Produtos", to: "/products", roles: ["admin", "manager", "stockist"] },
  { label: "Clientes", to: "/customers", roles: ["admin", "manager"] },
  { label: "Funcionários", to: "/employees", roles: ["admin", "manager"] },
  { label: "Configurações", to: "/settings", roles: ["admin"] },
];

const visibleItems = computed(() =>
  navItems.filter((item) =>
    item.roles.includes(auth.user?.role ?? ""),
  ),
);
</script>

<template>
  <aside class="hidden w-56 border-r bg-white md:block">
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
</template>
