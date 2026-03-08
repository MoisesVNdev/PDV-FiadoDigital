<script setup lang="ts">
import AppHeader from "@/components/layout/app-header.vue";
import AppSidebar from "@/components/layout/app-sidebar.vue";
</script>

<template>
  <div class="flex min-h-screen bg-surface">
    <AppSidebar />
    <div class="flex flex-1 flex-col">
      <AppHeader />
      <main class="flex-1 p-6">
        <h1 class="mb-4 text-2xl font-bold text-gray-800">Ponto de Venda</h1>
        <!-- TODO: Busca de produto (F2), carrinho, finalização (F4) -->
      </main>
    </div>
  </div>
</template>
