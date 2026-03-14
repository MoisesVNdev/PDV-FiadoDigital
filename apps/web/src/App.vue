<script setup lang="ts">
import { RouterView } from "vue-router";
import { useGlobalModalFocusTrap } from "@/composables/use-global-modal-focus-trap.js";

useGlobalModalFocusTrap();
</script>

<template>
  <RouterView />
</template>

<style scoped>
/* Layout global via Tailwind — ver main.css */
</style>
