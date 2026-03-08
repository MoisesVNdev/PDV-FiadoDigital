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
        <h1 class="mb-4 text-2xl font-bold text-gray-800">Dashboard</h1>
        <p class="text-gray-600">Indicadores de vendas e resumo financeiro.</p>
        <!-- TODO: Cards com indicadores de vendas do dia, saldo fiado, estoque baixo -->
      </main>
    </div>
  </div>
</template>
