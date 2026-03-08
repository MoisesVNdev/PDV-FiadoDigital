import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { router } from "./router/index.js";
import "./assets/main.css";

const pinia = createPinia();
const app = createApp(App);

app.use(pinia);

// Inicializar app após tentar restaurar sessão
(async () => {
  const { useAuthStore } = await import("./stores/auth.store.js");
  const auth = useAuthStore();

  // Tentar restaurar autenticação ANTES de registrar o router
  await auth.tryRestoreAuth();

  // Só registrar o router após a tentativa de restauração
  app.use(router);
  
  // Aguardar o router estar pronto
  await router.isReady();

  app.mount("#app");
})();
