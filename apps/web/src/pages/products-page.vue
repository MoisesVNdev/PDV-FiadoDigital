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
        <h1 class="mb-4 text-2xl font-bold text-gray-800">Produtos</h1>
        <!-- TODO: Listagem, cadastro, edição de produtos com estoque -->
      </main>
    </div>
  </div>
</template>
