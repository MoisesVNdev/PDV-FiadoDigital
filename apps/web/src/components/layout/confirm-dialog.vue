<script setup lang="ts">
interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

withDefaults(defineProps<Props>(), {
  confirmLabel: "Confirmar",
  cancelLabel: "Cancelar",
});

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

function onBackdropClick(event: MouseEvent): void {
  if (event.target !== event.currentTarget) {
    return;
  }

  emit("cancel");
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
    aria-labelledby="confirm-dialog-title"
    @click="onBackdropClick"
  >
    <div class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
      <h2 id="confirm-dialog-title" class="text-lg font-bold text-gray-900">
        {{ title }}
      </h2>
      <p class="mt-2 text-sm text-gray-700">
        {{ message }}
      </p>

      <div class="mt-6 flex justify-end gap-3">
        <button
          type="button"
          class="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          @click="emit('cancel')"
        >
          {{ cancelLabel }}
        </button>
        <button
          type="button"
          class="rounded bg-danger px-4 py-2 text-sm font-medium text-white transition hover:bg-danger/80"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
